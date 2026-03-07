import * as path from 'path';
import { createHash } from 'crypto';
import * as yaml from 'yaml';
import * as vscode from 'vscode';

const previewPanels = new Map<string, vscode.WebviewPanel>();

type SkillInputDefinition = {
	description?: string;
	required?: boolean;
	default?: string;
};

type SkillTemplate = {
	name: string;
	description: string;
	prompt: string;
	inputs: Record<string, SkillInputDefinition>;
	outputFormat?: string;
	fileUri: vscode.Uri;
};

type SkillDefinitionWithFolder = SkillTemplate & {
	folderUri: vscode.Uri;
};

type SkillRunRequest = {
	skill: SkillDefinitionWithFolder;
};

class FolderItem extends vscode.TreeItem {
	constructor(public readonly folderUri: vscode.Uri) {
		super(path.basename(folderUri.fsPath), vscode.TreeItemCollapsibleState.Collapsed);
		this.resourceUri = folderUri;
		this.contextValue = 'folderPilot.folder';
	}
}

class SkillItem extends vscode.TreeItem {
	constructor(public readonly skill: SkillDefinitionWithFolder) {
		super(skill.description, vscode.TreeItemCollapsibleState.None);
		this.tooltip = `${skill.name} (${path.basename(skill.fileUri.fsPath)})`;
		this.contextValue = 'folderPilot.skill';
		this.command = {
			command: 'folderPilot.runSkill',
			title: 'Run Skill',
			arguments: [this]
		};
	}
}

class FolderPilotProvider implements vscode.TreeDataProvider<FolderItem | SkillItem> {
	private readonly _onDidChangeTreeData = new vscode.EventEmitter<void>();
	readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
	private skillCache = new Map<string, SkillDefinitionWithFolder[]>();
	private globalSkillTemplates = new Map<string, Map<string, SkillTemplate>>();

	constructor(private readonly runner: SkillRunner, private readonly outputChannel: vscode.OutputChannel) {}

	refresh(): void {
		this.skillCache.clear();
		this.globalSkillTemplates.clear();
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: FolderItem | SkillItem): vscode.TreeItem {
		return element;
	}

	async getChildren(element?: FolderItem | SkillItem): Promise<Array<FolderItem | SkillItem>> {
		if (!element) {
			const folders = await findAgentFolders();
			return folders.map((folderUri) => new FolderItem(folderUri));
		}

		if (element instanceof FolderItem) {
			const skills = await this.getSkillsForFolder(element.folderUri);
			return skills.map((skill) => new SkillItem(skill));
		}

		return [];
	}

	async runSkill(target?: SkillItem | FolderItem): Promise<void> {
		if (!target) {
			const skill = await this.pickSkill();
			if (!skill) {
				return;
			}
			this.runner.enqueue({ skill });
			return;
		}

		if (target instanceof SkillItem) {
			this.runner.enqueue({ skill: target.skill });
			return;
		}

		const skills = await this.getSkillsForFolder(target.folderUri);
		const selected = await vscode.window.showQuickPick(
			skills.map((skill) => ({
				label: skill.description,
				description: skill.name,
				skill
			})),
			{ placeHolder: `Select a skill for ${path.basename(target.folderUri.fsPath)}` }
		);

		if (selected?.skill) {
			this.runner.enqueue({ skill: selected.skill });
		}
	}

	async clearCache(target?: SkillItem | FolderItem): Promise<void> {
		if (target instanceof SkillItem) {
			await clearCacheForSkill(target.skill, this.outputChannel);
			return;
		}
		if (target instanceof FolderItem) {
			const skills = await this.getSkillsForFolder(target.folderUri);
			if (skills.length === 0) {
				vscode.window.showInformationMessage('FolderPilot: No skills found in this folder.');
				return;
			}

			const selected = await vscode.window.showQuickPick(
				skills.map((skill) => ({
					label: skill.description,
					description: skill.name,
					skill
				})),
				{ placeHolder: `Select a skill to clear cache in ${path.basename(target.folderUri.fsPath)}` }
			);

			if (selected?.skill) {
				await clearCacheForSkill(selected.skill, this.outputChannel);
			}
			return;
		}

		const skill = await this.pickSkill();
		if (!skill) {
			return;
		}

		await clearCacheForSkill(skill, this.outputChannel);
	}

	private async pickSkill(): Promise<SkillDefinitionWithFolder | null> {
		const folders = await findAgentFolders();
		const allSkills: SkillDefinitionWithFolder[] = [];
		for (const folderUri of folders) {
			const skills = await this.getSkillsForFolder(folderUri);
			allSkills.push(...skills);
		}

		if (allSkills.length === 0) {
			vscode.window.showInformationMessage('FolderPilot: No skills found.');
			return null;
		}

		const selected = await vscode.window.showQuickPick(
			allSkills.map((skill) => ({
				label: skill.description,
				description: `${path.basename(skill.folderUri.fsPath)} • ${skill.name}`,
				skill
			})),
			{ placeHolder: 'Select a FolderPilot skill to run' }
		);

		return selected?.skill ?? null;
	}

	private async getSkillsForFolder(folderUri: vscode.Uri): Promise<SkillDefinitionWithFolder[]> {
		const cacheKey = folderUri.toString();
		const cached = this.skillCache.get(cacheKey);
		if (cached) {
			return cached;
		}

		const supportedSkillNames = await readInteractiveSkillNames(folderUri, this.outputChannel);
		if (supportedSkillNames.length === 0) {
			this.skillCache.set(cacheKey, []);
			return [];
		}

		const templates = await this.getGlobalSkillTemplates(folderUri);
		const skills: SkillDefinitionWithFolder[] = [];
		for (const name of supportedSkillNames) {
			const template = templates.get(name);
			if (!template) {
				this.outputChannel.appendLine(
					`FolderPilot: Skill ${name} not found in workspace .agent/interactive_skills for ${folderUri.fsPath}.`
				);
				continue;
			}
			skills.push({
				...template,
				folderUri
			});
		}

		this.skillCache.set(cacheKey, skills);
		return skills;
	}

	private async getGlobalSkillTemplates(folderUri: vscode.Uri): Promise<Map<string, SkillTemplate>> {
		const workspaceFolder = vscode.workspace.getWorkspaceFolder(folderUri);
		if (!workspaceFolder) {
			return new Map();
		}

		const workspaceKey = workspaceFolder.uri.fsPath;
		const cached = this.globalSkillTemplates.get(workspaceKey);
		if (cached) {
			return cached;
		}

		const skillsDirUri = vscode.Uri.joinPath(workspaceFolder.uri, '.agent', 'interactive_skills');
		if (!(await fileExists(skillsDirUri))) {
			const empty = new Map<string, SkillTemplate>();
			this.globalSkillTemplates.set(workspaceKey, empty);
			return empty;
		}

		const pattern = new vscode.RelativePattern(skillsDirUri.fsPath, '**/SKILL.md');
		const skillFiles = await vscode.workspace.findFiles(pattern, '**/node_modules/**');
		const templates = new Map<string, SkillTemplate>();
		for (const file of skillFiles) {
			const template = await parseSkillTemplate(file, this.outputChannel);
			if (template) {
				templates.set(template.name, template);
			}
		}

		this.globalSkillTemplates.set(workspaceKey, templates);
		return templates;
	}
}

class SkillRunner {
	private queue: SkillRunRequest[] = [];
	private running: SkillRunRequest | undefined;
	private runningCts: vscode.CancellationTokenSource | undefined;

	constructor(private readonly outputChannel: vscode.OutputChannel) {}

	enqueue(request: SkillRunRequest): void {
		const total = (this.running ? 1 : 0) + this.queue.length;
		if (total >= 5) {
			if (this.queue.length > 0) {
				const dropped = this.queue.shift();
				if (dropped) {
					vscode.window.showWarningMessage(
						`FolderPilot: Dropped queued skill ${dropped.skill.description} to keep queue under limit.`
					);
				}
			} else if (this.runningCts) {
				this.runningCts.cancel();
				vscode.window.showWarningMessage('FolderPilot: Cancelled running skill to admit new request.');
			}
		}

		this.queue.push(request);
		void this.runNext();
	}

	private async runNext(): Promise<void> {
		if (this.running) {
			return;
		}

		const next = this.queue.shift();
		if (!next) {
			return;
		}

		this.running = next;
		this.runningCts = new vscode.CancellationTokenSource();
		try {
			await this.executeSkill(next.skill, this.runningCts.token);
		} finally {
			this.running = undefined;
			this.runningCts.dispose();
			this.runningCts = undefined;
			if (this.queue.length > 0) {
				void this.runNext();
			}
		}
	}

	private async executeSkill(skill: SkillDefinitionWithFolder, token: vscode.CancellationToken): Promise<void> {
		await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: `FolderPilot: ${skill.description}`,
				cancellable: true
			},
			async (_progress, progressToken) => {
				progressToken.onCancellationRequested(() => this.runningCts?.cancel());

				const inputValues = await resolveInputs(skill);
				if (!inputValues) {
					return;
				}

				const outputFormat = normalizeOutputFormat(skill.outputFormat);
				const outputFileName = `${sanitizeFileName(skill.name)}.${outputFormat}`;
				const outputRelativePath = path.posix.join('tmp', outputFileName);
				const tmpUri = vscode.Uri.joinPath(skill.folderUri, 'tmp');

				await vscode.workspace.fs.createDirectory(tmpUri);
				const cacheKey = await buildSkillCacheKey(skill, inputValues);
				const cachedOutputs = await restoreOutputsFromCache(
					skill.folderUri,
					skill.name,
					cacheKey,
					this.outputChannel
				);
				if (cachedOutputs.length > 0) {
					this.outputChannel.appendLine(`FolderPilot: Cache hit for ${skill.name} (${cacheKey.slice(0, 12)}).`);
					vscode.window.setStatusBarMessage(`FolderPilot: Loaded ${skill.name} from cache`, 3000);
					await openOutput(cachedOutputs[0], skill.description, skill.folderUri);
					return;
				}

				const prompt = await buildPrompt(skill, inputValues, outputRelativePath, outputFormat);
				const responseText = await requestCopilotResponse(prompt, token, this.outputChannel);
				if (!responseText) {
					return;
				}

				const outputs = parseOutputs(responseText, outputFormat, outputRelativePath, skill.folderUri);
				if (outputs.length > 0) {
					await writeOutputs(skill.folderUri, outputs);
					await saveOutputsToCache(skill.folderUri, skill.name, cacheKey, outputs, this.outputChannel);
					await openOutput(outputs[0], skill.description, skill.folderUri);
					return;
				}

				const fallbackOutput = await findNewestOutput(tmpUri);
				if (fallbackOutput) {
					await openOutput(fallbackOutput, skill.description, skill.folderUri);
					return;
				}

				vscode.window.showErrorMessage('FolderPilot: No output generated.');
			}
		);
	}
}

type ParsedOutput = {
	uri: vscode.Uri;
	type: string;
	content?: string;
};

type CacheOutputDescriptor = {
	path: string;
	type: string;
};

type SkillCacheEntry = {
	key: string;
	createdAt: number;
	outputs: CacheOutputDescriptor[];
};

type SkillCacheManifest = {
	version: 1;
	latestKey?: string;
	entries: SkillCacheEntry[];
};

const CACHE_VERSION = 1;

async function buildSkillCacheKey(skill: SkillDefinitionWithFolder, inputValues: Record<string, string>): Promise<string> {
	const skillContent = new TextDecoder('utf-8').decode(await vscode.workspace.fs.readFile(skill.fileUri));
	const inputFiles = await collectInputFileStats(skill.folderUri);
	const sortedInputs = Object.entries(inputValues)
		.sort(([left], [right]) => left.localeCompare(right))
		.reduce<Record<string, string>>((acc, [name, value]) => {
			acc[name] = value;
			return acc;
		}, {});

	const payload = JSON.stringify({
		skillContent,
		inputValues: sortedInputs,
		inputFiles
	});
	return createHash('sha256').update(payload, 'utf8').digest('hex');
}

async function collectInputFileStats(folderUri: vscode.Uri): Promise<Array<{ path: string; mtime: number; size: number }>> {
	const stats: Array<{ path: string; mtime: number; size: number }> = [];

	const visit = async (current: vscode.Uri, relativeDir: string): Promise<void> => {
		const entries = await vscode.workspace.fs.readDirectory(current);
		entries.sort(([left], [right]) => left.localeCompare(right));

		for (const [name, fileType] of entries) {
			const relativePath = relativeDir ? `${relativeDir}/${name}` : name;
			const normalizedRelativePath = relativePath.replace(/\\/g, '/');
			if (normalizedRelativePath === '.agent' || normalizedRelativePath.startsWith('.agent/')) {
				continue;
			}
			if (normalizedRelativePath === '.git' || normalizedRelativePath.startsWith('.git/')) {
				continue;
			}
			if (normalizedRelativePath === 'tmp' || normalizedRelativePath.startsWith('tmp/')) {
				continue;
			}
			if (name === '.DS_Store' || name === 'Thumbs.db') {
				continue;
			}

			const itemUri = vscode.Uri.joinPath(current, name);
			const isDirectory = (fileType & vscode.FileType.Directory) !== 0;
			const isFile = (fileType & vscode.FileType.File) !== 0;

			if (isDirectory) {
				await visit(itemUri, normalizedRelativePath);
				continue;
			}

			if (!isFile) {
				continue;
			}

			const stat = await vscode.workspace.fs.stat(itemUri);
			stats.push({
				path: normalizedRelativePath,
				mtime: stat.mtime,
				size: stat.size
			});
		}
	};

	await visit(folderUri, '');
	return stats;
}

async function restoreOutputsFromCache(
	folderUri: vscode.Uri,
	skillName: string,
	cacheKey: string,
	outputChannel: vscode.OutputChannel
): Promise<ParsedOutput[]> {
	const manifest = await readSkillCacheManifest(folderUri, skillName);
	const entry = manifest.entries.find((candidate) => candidate.key === cacheKey);
	if (!entry) {
		return [];
	}

	const restoredOutputs: ParsedOutput[] = [];
	for (const output of entry.outputs) {
		const targetUri = vscode.Uri.joinPath(folderUri, output.path);
		const artifactUri = getCacheArtifactUri(folderUri, skillName, cacheKey, output.path);

		if (await fileExists(artifactUri)) {
			const bytes = await vscode.workspace.fs.readFile(artifactUri);
			const targetDir = vscode.Uri.file(path.dirname(targetUri.fsPath));
			await vscode.workspace.fs.createDirectory(targetDir);
			await vscode.workspace.fs.writeFile(targetUri, bytes);
			restoredOutputs.push({ uri: targetUri, type: output.type });
			continue;
		}

		if (await fileExists(targetUri)) {
			restoredOutputs.push({ uri: targetUri, type: output.type });
		}
	}

	if (restoredOutputs.length === 0) {
		outputChannel.appendLine(
			`FolderPilot: Cache manifest found for ${skillName}, but no artifacts were available for ${cacheKey.slice(0, 12)}.`
		);
	}

	return restoredOutputs;
}

async function saveOutputsToCache(
	folderUri: vscode.Uri,
	skillName: string,
	cacheKey: string,
	outputs: ParsedOutput[],
	outputChannel: vscode.OutputChannel
): Promise<void> {
	const descriptors: CacheOutputDescriptor[] = [];
	for (const output of outputs) {
		const targetUri = toFolderUri(folderUri, output.uri);
		if (!(await fileExists(targetUri))) {
			continue;
		}

		const relativeOutputPath = toRelativePath(folderUri, targetUri);
		if (!relativeOutputPath || relativeOutputPath.startsWith('../')) {
			continue;
		}

		const artifactUri = getCacheArtifactUri(folderUri, skillName, cacheKey, relativeOutputPath);
		const artifactDir = vscode.Uri.file(path.dirname(artifactUri.fsPath));
		await vscode.workspace.fs.createDirectory(artifactDir);
		const bytes = await vscode.workspace.fs.readFile(targetUri);
		await vscode.workspace.fs.writeFile(artifactUri, bytes);

		descriptors.push({
			path: relativeOutputPath,
			type: normalizeOutputFormat(output.type)
		});
	}

	if (descriptors.length === 0) {
		return;
	}

	const manifest = await readSkillCacheManifest(folderUri, skillName);
	const nextEntries = manifest.entries.filter((entry) => entry.key !== cacheKey);
	nextEntries.unshift({
		key: cacheKey,
		createdAt: Date.now(),
		outputs: descriptors
	});

	const nextManifest: SkillCacheManifest = {
		version: CACHE_VERSION,
		latestKey: cacheKey,
		entries: nextEntries.slice(0, 40)
	};

	await writeSkillCacheManifest(folderUri, skillName, nextManifest);
	outputChannel.appendLine(`FolderPilot: Cache saved for ${skillName} (${cacheKey.slice(0, 12)}).`);
}

async function readSkillCacheManifest(folderUri: vscode.Uri, skillName: string): Promise<SkillCacheManifest> {
	const manifestUri = getSkillCacheManifestUri(folderUri, skillName);
	if (!(await fileExists(manifestUri))) {
		return { version: CACHE_VERSION, entries: [] };
	}

	try {
		const bytes = await vscode.workspace.fs.readFile(manifestUri);
		const parsed = JSON.parse(new TextDecoder('utf-8').decode(bytes)) as Partial<SkillCacheManifest>;
		if (!parsed || !Array.isArray(parsed.entries)) {
			return { version: CACHE_VERSION, entries: [] };
		}
		return {
			version: CACHE_VERSION,
			latestKey: typeof parsed.latestKey === 'string' ? parsed.latestKey : undefined,
			entries: parsed.entries
				.filter((entry): entry is SkillCacheEntry => {
					return (
						typeof (entry as SkillCacheEntry).key === 'string' &&
						typeof (entry as SkillCacheEntry).createdAt === 'number' &&
						Array.isArray((entry as SkillCacheEntry).outputs)
					);
				})
				.map((entry) => ({
					key: entry.key,
					createdAt: entry.createdAt,
					outputs: entry.outputs
						.filter((output): output is CacheOutputDescriptor => {
							return typeof output.path === 'string' && typeof output.type === 'string';
						})
						.map((output) => ({ path: output.path, type: output.type }))
				}))
		};
	} catch {
		return { version: CACHE_VERSION, entries: [] };
	}
}

async function writeSkillCacheManifest(
	folderUri: vscode.Uri,
	skillName: string,
	manifest: SkillCacheManifest
): Promise<void> {
	const manifestUri = getSkillCacheManifestUri(folderUri, skillName);
	const manifestDir = vscode.Uri.file(path.dirname(manifestUri.fsPath));
	await vscode.workspace.fs.createDirectory(manifestDir);
	const json = JSON.stringify(manifest, null, 2);
	await vscode.workspace.fs.writeFile(manifestUri, new TextEncoder().encode(json));
}

function getSkillCacheManifestUri(folderUri: vscode.Uri, skillName: string): vscode.Uri {
	return vscode.Uri.joinPath(folderUri, '.agent', 'cache', `${sanitizeFileName(skillName)}.manifest.json`);
}

function getCacheArtifactUri(folderUri: vscode.Uri, skillName: string, cacheKey: string, relativeOutputPath: string): vscode.Uri {
	return vscode.Uri.joinPath(
		folderUri,
		'.agent',
		'cache',
		'artifacts',
		sanitizeFileName(skillName),
		cacheKey,
		relativeOutputPath
	);
}

function toRelativePath(folderUri: vscode.Uri, fileUri: vscode.Uri): string {
	return path.relative(folderUri.fsPath, fileUri.fsPath).replace(/\\/g, '/');
}

async function fileExists(uri: vscode.Uri): Promise<boolean> {
	try {
		await vscode.workspace.fs.stat(uri);
		return true;
	} catch {
		return false;
	}
}

async function clearCacheForSkill(skill: SkillDefinitionWithFolder, outputChannel: vscode.OutputChannel): Promise<void> {
	const skillName = skill.name;
	const folderUri = skill.folderUri;
	const manifestUri = getSkillCacheManifestUri(folderUri, skillName);
	const artifactsUri = vscode.Uri.joinPath(folderUri, '.agent', 'cache', 'artifacts', sanitizeFileName(skillName));

	let deletedSomething = false;
	if (await fileExists(manifestUri)) {
		await vscode.workspace.fs.delete(manifestUri, { useTrash: true });
		deletedSomething = true;
	}

	if (await fileExists(artifactsUri)) {
		await vscode.workspace.fs.delete(artifactsUri, { recursive: true, useTrash: true });
		deletedSomething = true;
	}

	const label = `${skillName} (${path.basename(folderUri.fsPath)})`;
	if (!deletedSomething) {
		outputChannel.appendLine(`FolderPilot: No cache found for ${label}.`);
		vscode.window.showInformationMessage(`FolderPilot: No cache found for ${label}.`);
		return;
	}

	outputChannel.appendLine(`FolderPilot: Cleared cache for ${label}.`);
	vscode.window.setStatusBarMessage(`FolderPilot: Cleared cache for ${label}`, 3000);
}

async function findAgentFolders(): Promise<vscode.Uri[]> {
	const skillFiles = await vscode.workspace.findFiles('**/.agent/interactive_skills.yaml', '**/node_modules/**');
	const folders = new Map<string, vscode.Uri>();
	for (const file of skillFiles) {
		const agentDir = path.dirname(file.fsPath);
		const folderPath = path.dirname(agentDir);
		const folderUri = vscode.Uri.file(folderPath);
		folders.set(folderUri.fsPath, folderUri);
	}
	return Array.from(folders.values()).sort((a, b) => a.fsPath.localeCompare(b.fsPath));
}

async function parseSkillTemplate(
	fileUri: vscode.Uri,
	outputChannel: vscode.OutputChannel
): Promise<SkillTemplate | null> {
	const raw = await vscode.workspace.fs.readFile(fileUri);
	const content = new TextDecoder('utf-8').decode(raw);
	const parsed = extractFrontmatter(content);
	if (!parsed) {
		outputChannel.appendLine(`FolderPilot: No frontmatter found in ${fileUri.fsPath}`);
		return null;
	}

	let meta: Record<string, unknown>;
	try {
		meta = yaml.parse(parsed.frontmatter) as Record<string, unknown>;
	} catch (error) {
		outputChannel.appendLine(`FolderPilot: Failed to parse YAML in ${fileUri.fsPath}: ${String(error)}`);
		return null;
	}

	const name = typeof meta.name === 'string' ? meta.name.trim() : '';
	const description = typeof meta.description === 'string' ? meta.description.trim() : '';
	const prompt = typeof meta.prompt === 'string' ? meta.prompt.trim() : '';
	const outputFormat =
		typeof meta.output_format === 'string'
			? meta.output_format
			: typeof (meta as { outputFormat?: string }).outputFormat === 'string'
				? (meta as { outputFormat?: string }).outputFormat
				: undefined;
	const inputs = typeof meta.inputs === 'object' && meta.inputs ? (meta.inputs as Record<string, SkillInputDefinition>) : {};

	if (!name || !description || !prompt) {
		outputChannel.appendLine(`FolderPilot: Missing required fields in ${fileUri.fsPath}`);
		return null;
	}

	return {
		name,
		description,
		prompt,
		inputs,
		outputFormat,
		fileUri
	};
}

function getInteractiveSkillsListUri(folderUri: vscode.Uri): vscode.Uri {
	return vscode.Uri.joinPath(folderUri, '.agent', 'interactive_skills.yaml');
}

async function readInteractiveSkillNames(
	folderUri: vscode.Uri,
	outputChannel: vscode.OutputChannel
): Promise<string[]> {
	const listUri = getInteractiveSkillsListUri(folderUri);
	if (!(await fileExists(listUri))) {
		return [];
	}

	try {
		const content = new TextDecoder('utf-8').decode(await vscode.workspace.fs.readFile(listUri));
		const fromYaml = parseSkillNameListFromYaml(content);
		const fromLines = parseSkillNameListFromLines(content);
		const names = fromYaml.length > 0 ? fromYaml : fromLines;
		return Array.from(new Set(names));
	} catch (error) {
		outputChannel.appendLine(
			`FolderPilot: Failed to read interactive_skills.yaml in ${folderUri.fsPath}: ${String(error)}`
		);
		return [];
	}
}

function parseSkillNameListFromYaml(content: string): string[] {
	try {
		const parsed = yaml.parse(content) as unknown;
		if (Array.isArray(parsed)) {
			return parsed
				.map((item) => (typeof item === 'string' ? item.trim() : String(item)))
				.filter((item) => item.length > 0);
		}
		if (parsed && typeof parsed === 'object') {
			const skills = (parsed as { skills?: unknown }).skills;
			if (Array.isArray(skills)) {
				return skills
					.filter((item): item is string => typeof item === 'string')
					.map((item) => item.trim())
					.filter((item) => item.length > 0);
			}
		}
	} catch {
		return [];
	}

	return [];
}

function parseSkillNameListFromLines(content: string): string[] {
	return content
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0 && !line.startsWith('#'));
}

function extractFrontmatter(content: string): { frontmatter: string; body: string } | null {
	const topMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
	if (topMatch) {
		return { frontmatter: topMatch[1], body: topMatch[2] };
	}

	const regex = /---\s*\n([\s\S]*?)\n---\s*/g;
	let match: RegExpExecArray | null;
	while ((match = regex.exec(content)) !== null) {
		if (!/\bname\s*:/i.test(match[1])) {
			continue;
		}
		const body = content.slice(match.index + match[0].length);
		return { frontmatter: match[1], body };
	}

	return null;
}

async function resolveInputs(skill: SkillDefinitionWithFolder): Promise<Record<string, string> | null> {
	const resolved: Record<string, string> = {};
	for (const [name, definition] of Object.entries(skill.inputs ?? {})) {
		const defaultValue =
			typeof definition.default === 'string'
				? definition.default
				: definition.default !== undefined
					? String(definition.default)
					: '';
		const value = await vscode.window.showInputBox({
			prompt: definition.description ? `${name}: ${definition.description}` : `Provide value for ${name}`,
			value: defaultValue
		});
		if (value === undefined) {
			return null;
		}

		const trimmed = value.trim();
		if (definition.required && !trimmed) {
			vscode.window.showInformationMessage(`FolderPilot: ${name} is required.`);
			return null;
		}
		resolved[name] = trimmed || defaultValue;
	}

	return resolved;
}

async function buildPrompt(
	skill: SkillDefinitionWithFolder,
	inputs: Record<string, string>,
	outputRelativePath: string,
	outputFormat: string
): Promise<string> {
	const folderEntries = await listFolderEntries(skill.folderUri);
	const filledPrompt = skill.prompt.replace(/\$\{input:([^}]+)\}/g, (_match, name) => inputs[name] ?? '');

	return [
		'You are GitHub Copilot running inside VS Code.',
		'Return ONLY a JSON object with this shape:',
		`{"outputs":[{"path":"${outputRelativePath}","type":"${outputFormat}","content":"..."}]}`,
		'Ensure the JSON is valid and content is properly escaped.',
		'Do not wrap the JSON in code fences or extra commentary.',
		`Output must be written to ${outputRelativePath}.`,
		`Folder context (top-level): ${folderEntries.join(', ') || 'empty'}.`,
		`Skill prompt:\n${filledPrompt}`
	].join('\n');
}

async function listFolderEntries(folderUri: vscode.Uri): Promise<string[]> {
	try {
		const entries = await vscode.workspace.fs.readDirectory(folderUri);
		return entries
			.filter(([name]) => name !== '.agent' && name !== 'tmp')
			.map(([name, type]) => (type === vscode.FileType.Directory ? `${name}/` : name))
			.slice(0, 100);
	} catch {
		return [];
	}
}

async function requestCopilotResponse(
	prompt: string,
	token: vscode.CancellationToken,
	outputChannel: vscode.OutputChannel
): Promise<string | null> {
	const lmApi = (vscode as unknown as { lm?: typeof vscode.lm }).lm;
	if (!lmApi) {
		vscode.window.showErrorMessage('FolderPilot: GitHub Copilot is not available in this VS Code version.');
		return null;
	}

	try {
		const models = prioritizeModels(await lmApi.selectChatModels({ vendor: 'copilot' }));
		if (models.length === 0) {
			vscode.window.showErrorMessage('FolderPilot: GitHub Copilot is not available or authenticated.');
			return null;
		}

		let lastError: unknown;
		const attemptPrompts = [
			prompt,
			[
				prompt,
				'',
				'If you cannot return JSON, return only one fenced code block containing the output file content.',
				'Do not include any explanation.'
			].join('\n')
		];

		for (const model of models) {
			for (let index = 0; index < attemptPrompts.length; index += 1) {
				if (token.isCancellationRequested) {
					return null;
				}

				try {
					const response = await model.sendRequest(
						[vscode.LanguageModelChatMessage.User(attemptPrompts[index])],
						{},
						token
					);
					const text = await collectResponseText(response);
					if (text.trim()) {
						return text;
					}

					lastError = new Error('Copilot returned an empty response.');
					outputChannel.appendLine(
						`FolderPilot: Empty response from model ${model.id} (attempt ${index + 1}/${attemptPrompts.length}).`
					);
				} catch (error) {
					lastError = error;
					outputChannel.appendLine(
						`FolderPilot: Model ${model.id} failed (attempt ${index + 1}/${attemptPrompts.length}): ${String(error)}`
					);
					if (!isNoChoicesError(error)) {
						break;
					}
				}
			}
		}

		if (lastError instanceof vscode.LanguageModelError) {
			vscode.window.showErrorMessage(
				`FolderPilot: Copilot request failed (${lastError.code}). Ensure Copilot is installed and signed in.`
			);
			return null;
		}

		if (isNoChoicesError(lastError)) {
			vscode.window.showErrorMessage(
				'FolderPilot: Copilot returned no choices for this request. Try again, or simplify the skill prompt.'
			);
			return null;
		}

		vscode.window.showErrorMessage(`FolderPilot: Copilot request failed: ${String(lastError ?? 'Unknown error')}`);
		return null;
	} catch (error) {
		if (error instanceof vscode.LanguageModelError) {
			vscode.window.showErrorMessage(
				`FolderPilot: Copilot request failed (${error.code}). Ensure Copilot is installed and signed in.`
			);
			return null;
		}
		vscode.window.showErrorMessage(`FolderPilot: Copilot request failed: ${String(error)}`);
		return null;
	}
}

async function collectResponseText(response: vscode.LanguageModelChatResponse): Promise<string> {
	let result = '';
	for await (const fragment of response.text) {
		result += fragment;
	}

	if (result.trim()) {
		return result;
	}

	for await (const part of response.stream) {
		if (part instanceof vscode.LanguageModelTextPart) {
			result += part.value;
		}
	}

	return result;
}

function prioritizeModels(models: vscode.LanguageModelChat[]): vscode.LanguageModelChat[] {
	const preferredFamilies = ['gpt-4.1', 'gpt-4o', 'o4', 'o3'];
	const score = (model: vscode.LanguageModelChat): number => {
		const family = model.family.toLowerCase();
		const idx = preferredFamilies.findIndex((candidate) => family.includes(candidate));
		return idx === -1 ? preferredFamilies.length + 1 : idx;
	};

	return [...models].sort((a, b) => score(a) - score(b));
}

function isNoChoicesError(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error ?? '');
	return /no choices/i.test(message);
}

function parseOutputs(
	responseText: string,
	outputFormat: string,
	outputRelativePath: string,
	folderUri: vscode.Uri
): ParsedOutput[] {
	const parsed = extractJson(responseText);
	if (parsed && Array.isArray(parsed.outputs)) {
		return parsed.outputs
			.filter((output: { path?: string; type?: string; content?: string }) => output.path || output.content)
			.map((output: { path?: string; type?: string; content?: string }) => {
				const rawPath = output.path ?? outputRelativePath;
				const normalized = rawPath.replace(/^[/\\]+/, '').replace(/\\/g, '/');
				const safeRelative = normalized.startsWith('tmp/') ? normalized : outputRelativePath;
				const uri = path.isAbsolute(rawPath)
					? vscode.Uri.joinPath(folderUri, outputRelativePath)
					: vscode.Uri.joinPath(folderUri, safeRelative);
				return {
					uri,
					type: output.type ?? outputFormat,
					content: output.content
				};
			});
	}

	const fallbackContent = extractFirstCodeBlock(responseText);
	if (fallbackContent) {
		return [
			{
				uri: vscode.Uri.joinPath(folderUri, outputRelativePath),
				type: outputFormat,
				content: fallbackContent
			}
		];
	}

	return [];
}

function extractJson(text: string): { outputs?: Array<{ path?: string; type?: string; content?: string }> } | null {
	const trimmed = text.trim();
	try {
		return JSON.parse(trimmed);
	} catch {
		// ignore
	}

	const codeBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
	if (codeBlock) {
		try {
			return JSON.parse(codeBlock[1]);
		} catch {
			// ignore
		}
	}

	const firstBrace = trimmed.indexOf('{');
	const lastBrace = trimmed.lastIndexOf('}');
	if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
		try {
			return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
		} catch {
			// ignore
		}
	}

	return null;
}

function extractFirstCodeBlock(text: string): string | null {
	const match = text.match(/```(?:html|md|markdown)?\s*([\s\S]*?)```/i);
	if (!match) {
		return null;
	}
	return match[1].trim();
}

async function writeOutputs(folderUri: vscode.Uri, outputs: ParsedOutput[]): Promise<void> {
	for (const output of outputs) {
		const targetUri = toFolderUri(folderUri, output.uri);
		if (output.content !== undefined) {
			const targetDir = vscode.Uri.file(path.dirname(targetUri.fsPath));
			await vscode.workspace.fs.createDirectory(targetDir);
			await vscode.workspace.fs.writeFile(targetUri, new TextEncoder().encode(output.content));
		}
	}
}

function toFolderUri(folderUri: vscode.Uri, outputUri: vscode.Uri): vscode.Uri {
	if (path.isAbsolute(outputUri.fsPath)) {
		return outputUri;
	}

	return vscode.Uri.joinPath(folderUri, outputUri.fsPath);
}

function getPreviewPanel(outputUri: vscode.Uri, folderUri: vscode.Uri, title: string): vscode.WebviewPanel {
	const key = outputUri.fsPath;
	const existing = previewPanels.get(key);
	if (existing) {
		existing.title = title;
		existing.reveal(vscode.ViewColumn.Active, true);
		return existing;
	}

	const panel = vscode.window.createWebviewPanel(
		'folderPilot.preview',
		title,
		vscode.ViewColumn.Active,
		{ enableScripts: true, localResourceRoots: [folderUri] }
	);
	panel.onDidDispose(() => previewPanels.delete(key));
	previewPanels.set(key, panel);
	return panel;
}

async function openOutput(output: ParsedOutput, title: string, folderUri: vscode.Uri): Promise<void> {
	const type = normalizeOutputFormat(output.type);
	if (type === 'html') {
		const content = output.content
			? output.content
			: new TextDecoder('utf-8').decode(await vscode.workspace.fs.readFile(output.uri));
		const panel = getPreviewPanel(output.uri, folderUri, title);
		panel.webview.html = content;
		return;
	}

	if (type === 'md') {
		await vscode.commands.executeCommand(
			'vscode.openWith',
			output.uri,
			'vscode.markdown.preview.editor',
			vscode.ViewColumn.Active
		);
		return;
	}

	await vscode.commands.executeCommand('vscode.open', output.uri, {
		viewColumn: vscode.ViewColumn.Active,
		preview: false
	});
}

async function findNewestOutput(tmpUri: vscode.Uri): Promise<ParsedOutput | null> {
	try {
		const entries = await vscode.workspace.fs.readDirectory(tmpUri);
		const candidates = entries.filter(([name]) => hasSupportedExtension(name));
		if (candidates.length === 0) {
			return null;
		}
		let newest: { uri: vscode.Uri; mtime: number } | null = null;
		for (const [name] of candidates) {
			const uri = vscode.Uri.joinPath(tmpUri, name);
			const stat = await vscode.workspace.fs.stat(uri);
			if (!newest || stat.mtime > newest.mtime) {
				newest = { uri, mtime: stat.mtime };
			}
		}
		if (!newest) {
			return null;
		}
		return { uri: newest.uri, type: extensionToType(path.extname(newest.uri.fsPath)) };
	} catch {
		return null;
	}
}

function hasSupportedExtension(fileName: string): boolean {
	const ext = path.extname(fileName).toLowerCase();
	return ['.html', '.htm', '.md', '.markdown', '.png', '.jpg', '.jpeg'].includes(ext);
}

function extensionToType(ext: string): string {
	const normalized = ext.toLowerCase();
	if (normalized === '.md' || normalized === '.markdown') {
		return 'md';
	}
	if (normalized === '.jpg' || normalized === '.jpeg') {
		return 'jpg';
	}
	if (normalized === '.png') {
		return 'png';
	}
	return 'html';
}

function normalizeOutputFormat(format?: string): string {
	const normalized = (format ?? 'html').toLowerCase();
	if (normalized === 'markdown') {
		return 'md';
	}
	if (normalized === 'jpeg') {
		return 'jpg';
	}
	if (normalized === 'png' || normalized === 'jpg' || normalized === 'md' || normalized === 'html') {
		return normalized;
	}
	return 'html';
}

function sanitizeFileName(value: string): string {
	return value.replace(/[^a-z0-9_-]+/gi, '_').toLowerCase();
}

export function activate(context: vscode.ExtensionContext) {
	const outputChannel = vscode.window.createOutputChannel('FolderPilot');
	const runner = new SkillRunner(outputChannel);
	const provider = new FolderPilotProvider(runner, outputChannel);

	context.subscriptions.push(
		outputChannel,
		vscode.window.createTreeView('folderPilotExplorer', { treeDataProvider: provider }),
		vscode.commands.registerCommand('folderPilot.refresh', () => provider.refresh()),
		vscode.commands.registerCommand('folderPilot.runSkill', (item?: SkillItem | FolderItem) => provider.runSkill(item)),
		vscode.commands.registerCommand('folderPilot.clearCache', (item?: SkillItem | FolderItem) => provider.clearCache(item))
	);

	const skillsWatcher = vscode.workspace.createFileSystemWatcher('**/.agent/interactive_skills/**/SKILL.md');
	skillsWatcher.onDidCreate(() => provider.refresh());
	skillsWatcher.onDidChange(() => provider.refresh());
	skillsWatcher.onDidDelete(() => provider.refresh());

	const supportedWatcher = vscode.workspace.createFileSystemWatcher('**/.agent/interactive_skills.yaml');
	supportedWatcher.onDidCreate(() => provider.refresh());
	supportedWatcher.onDidChange(() => provider.refresh());
	supportedWatcher.onDidDelete(() => provider.refresh());

	context.subscriptions.push(skillsWatcher, supportedWatcher);
}

export function deactivate() {}
