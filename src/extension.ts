import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import simpleGit from 'simple-git';

let startTime: number;
let activeFile: string | undefined;
let activeProject: string | undefined;
let statusBarItem: vscode.StatusBarItem;
let timerInterval: NodeJS.Timeout | undefined;

const git = simpleGit();
const outputChannel = vscode.window.createOutputChannel('Project Time Tracker');

async function getGitUserInfo() {
	try {
		const userName = await git.raw(['config', 'user.name']);
		const userEmail = await git.raw(['config', 'user.email']);
		outputChannel.appendLine(`Git User Info: ${userName.trim()} <${userEmail.trim()}>`);
		return { name: userName.trim(), email: userEmail.trim() };
	} catch (error) {
		outputChannel.appendLine(`Error getting git user info: ${error}`);
		return { name: 'Unknown', email: 'unknown@example.com' };
	}
}

export function activate(context: vscode.ExtensionContext) {
	outputChannel.appendLine('Project Time Tracker extension is now active!');

	// Statusleistelement erstellen
	statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBarItem.text = "Time Spent: 0h 0m 0s";
	statusBarItem.command = 'projectTimeTracker.showStats';
	statusBarItem.show();
	context.subscriptions.push(statusBarItem);

	// Befehl zum Öffnen der Webview registrieren
	const disposable = vscode.commands.registerCommand('projectTimeTracker.showStats', () => {
		ProjectTimeTrackerPanel.createOrShow(context.extensionUri);
	});
	context.subscriptions.push(disposable);

	// Startzeit beim Öffnen einer Datei erfassen
	vscode.workspace.onDidOpenTextDocument((document) => {
		if (isFileInWorkspace(document.fileName)) {
			startTime = Date.now();
			outputChannel.appendLine(`Started tracking time for file: ${document.fileName}`);
			activeFile = document.fileName;
			activeProject = vscode.workspace.name;
			updateStatusBar();
			startTimer();
		}
	});

	// Zeit erfassen, wenn der Editor den Fokus verliert
	vscode.window.onDidChangeWindowState((windowState) => {
		outputChannel.appendLine('Editor window state changed');
		if (!windowState.focused && activeFile) {
			logTime();
			stopTimer();
		}
	});

	// Zeit erfassen, wenn eine andere Datei geöffnet wird
	vscode.workspace.onDidCloseTextDocument((document) => {
		outputChannel.appendLine('Document closed');
		if (document.fileName === activeFile) {
			logTime();
			stopTimer();
			activeFile = undefined;
		}
	});

	// Zeit erfassen, wenn VS Code gespeichert wird
	vscode.workspace.onDidSaveTextDocument((document) => {
		if (document.fileName === activeFile) {
			outputChannel.appendLine('Document saved');
			logTime();
			startTime = Date.now();
		}
	});

	// Bei Änderungen der aktiven Texteditoren aktualisieren
	vscode.window.onDidChangeActiveTextEditor((editor) => {
		outputChannel.appendLine('Active editor changed');
		if (editor && isFileInWorkspace(editor.document.fileName)) {
			if (editor.document.fileName === activeFile) {
				startTime = Date.now();
				startTimer();
			} else {
				stopTimer();
				activeFile = editor.document.fileName;
				startTime = Date.now();
				startTimer();
			}
		} else {
			stopTimer();
			activeFile = undefined;
		}
	});
}

// Funktion, um die Zeit zu protokollieren
async function logTime() {
	if (!activeFile) return;

	const endTime = Date.now();
	const timeSpent = Math.round((endTime - startTime) / 1000); // Zeit in Sekunden
	outputChannel.appendLine(`Time spent: ${timeSpent} seconds`);

	// Workspace-Verzeichnis ermitteln
	const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
	if (!workspaceFolder) {
		return;
	}

	const { name, email } = await getGitUserInfo();

	const logFilePath = path.join(workspaceFolder, '.vscode/time_log.json');
	outputChannel.appendLine(`Log file path: ${logFilePath}`);
	let logData: any = {};

	// Bestehende Log-Daten laden, falls vorhanden
	if (fs.existsSync(logFilePath)) {
		const existingLog = fs.readFileSync(logFilePath, 'utf8');
		logData = JSON.parse(existingLog);
		outputChannel.appendLine(`Existing log data: ${JSON.stringify(logData)}`);
	}

	if (!logData[activeProject!]) {
		logData[activeProject!] = {};
	}

	if (!logData[activeProject!][activeFile!]) {
		logData[activeProject!][activeFile!] = [];
	}

	logData[activeProject!][activeFile!].push({
		date: new Date().toISOString(),
		user: { name, email },
		timeSpent
	});

	fs.writeFileSync(logFilePath, JSON.stringify(logData, null, 2), 'utf8');
	startTime = endTime;
}

// Timer starten
function startTimer() {
	outputChannel.appendLine('Timer started');
	if (timerInterval) {
		clearInterval(timerInterval);
	}
	timerInterval = setInterval(updateStatusBar, 1000);
}

// Timer stoppen
function stopTimer() {
	outputChannel.appendLine('Timer stopped');
	if (timerInterval) {
		clearInterval(timerInterval);
		timerInterval = undefined;
	}
}

// Statusleiste aktualisieren
function updateStatusBar() {
	const currentTime = Date.now();
	const elapsedSeconds = Math.round((currentTime - startTime) / 1000);
	statusBarItem.text = `Time Spent: ${formatTime(elapsedSeconds)}`;
}

// Zeit formatieren
function formatTime(seconds: number): string {
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = seconds % 60;
	return `${h}h ${m}m ${s}s`;
}

// Überprüfen, ob die Datei im Projektverzeichnis liegt
function isFileInWorkspace(file: string): boolean {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders) {
		return false;
	}
	return workspaceFolders.some(folder => file.startsWith(folder.uri.fsPath));
}

export function deactivate() {
	outputChannel.appendLine('Project Time Tracker extension is now deactivated');
	if (activeFile) {
		logTime();
	}
	stopTimer();
}

class ProjectTimeTrackerPanel {
	public static currentPanel: ProjectTimeTrackerPanel | undefined;

	public static readonly viewType = 'projectTimeTracker';

	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionUri: vscode.Uri;
	private _disposables: vscode.Disposable[] = [];

	public static createOrShow(extensionUri: vscode.Uri) {
		const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

		// If we already have a panel, show it.
		if (ProjectTimeTrackerPanel.currentPanel) {
			ProjectTimeTrackerPanel.currentPanel._panel.reveal(column);
			ProjectTimeTrackerPanel.currentPanel._update();
			return;
		}

		// Otherwise, create a new panel.
		const panel = vscode.window.createWebviewPanel(
			ProjectTimeTrackerPanel.viewType,
			'Project Time Tracker',
			column ?? vscode.ViewColumn.One,
			{
				// Enable javascript in the webview
				enableScripts: true,

				// And restrict the webview to only loading content from our extension's `media` directory.
				localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
			}
		);

		ProjectTimeTrackerPanel.currentPanel = new ProjectTimeTrackerPanel(panel, extensionUri);
	}

	private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
		this._panel = panel;
		this._extensionUri = extensionUri;

		// Set the webview's initial html content
		this._update();

		// Listen for when the panel is disposed
		// This happens when the user closes the panel or when the panel is closed programmatically
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

		// Update the content based on view changes
		this._panel.onDidChangeViewState(
			e => {
				if (this._panel.visible) {
					this._update();
				}
			},
			null,
			this._disposables
		);

		// Handle messages from the webview
		this._panel.webview.onDidReceiveMessage(
			message => {
				switch (message.command) {
					case 'alert':
						vscode.window.showErrorMessage(message.text);
						return;
					case 'export':
						this._exportData();
						return;
				}
			},
			null,
			this._disposables
		);
	}

	private _exportData() {
		const logFilePath = path.join(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '', '.vscode/time_log.json');
		const savePath = path.join(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '', 'time_log_export.json');
		if (fs.existsSync(logFilePath)) {
			fs.copyFileSync(logFilePath, savePath);
			vscode.window.showInformationMessage('Protokolldaten wurden exportiert: ' + savePath);
		} else {
			vscode.window.showErrorMessage('Keine Protokolldaten gefunden.');
		}
	}

	public dispose() {
		ProjectTimeTrackerPanel.currentPanel = undefined;

		// Clean up our resources
		this._panel.dispose();

		while (this._disposables.length) {
			const x = this._disposables.pop();
			if (x) {
				x.dispose();
			}
		}
	}

	private async _update() {
		const logFilePath = path.join(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '', '.vscode/time_log.json');
		let logData: any = {};

		if (fs.existsSync(logFilePath)) {
			const existingLog = fs.readFileSync(logFilePath, 'utf8');
			logData = JSON.parse(existingLog);
		}

		const timeSpentByFile: { [key: string]: number } = {};
		const timeDetailsByFile: { [key: string]: { user: string, totalTime: number }[] } = {};

		for (const project in logData) {
			for (const file in logData[project]) {
				if (!timeSpentByFile[file]) {
					timeSpentByFile[file] = 0;
				}
				if (!timeDetailsByFile[file]) {
					timeDetailsByFile[file] = [];
				}

				const userTimeMap: { [key: string]: number } = {};

				for (const entry of logData[project][file]) {
					const userKey = `${entry.user.name} <${entry.user.email}>`;
					if (!userTimeMap[userKey]) {
						userTimeMap[userKey] = 0;
					}
					userTimeMap[userKey] += entry.timeSpent;
					timeSpentByFile[file] += entry.timeSpent;
				}

				for (const user in userTimeMap) {
					timeDetailsByFile[file].push({
						user,
						totalTime: userTimeMap[user]
					});
				}
			}
		}

		const sortedFiles = Object.keys(timeSpentByFile).sort((a, b) => timeSpentByFile[b] - timeSpentByFile[a]);

		this._panel.webview.html = this._getHtmlForWebview(sortedFiles, timeSpentByFile, timeDetailsByFile);
	}

	private _getHtmlForWebview(sortedFiles: string[], timeSpentByFile: { [key: string]: number }, timeDetailsByFile: { [key: string]: { user: string, totalTime: number }[] }) {
		const searchAndFilter = `
            <div>
                <input type="text" id="search" placeholder="Search files or users..." oninput="filterResults()">
            </div>
        `;

		const exportButton = `
            <div>
                <button onclick="exportData()">Export Data</button>
            </div>
        `;

		const progressBars = sortedFiles.map(file => {
			const timeSpent = timeSpentByFile[file];
			const details = timeDetailsByFile[file].map(detail => `
                <li>${detail.user}: ${formatTime(detail.totalTime)}</li>
            `).join('');

			return `
                <div class="file-entry" data-file="${file.toLowerCase()}" data-users="${timeDetailsByFile[file].map(d => d.user.toLowerCase()).join(', ')}">
                    <h3>${file}</h3>
                    <progress value="${timeSpent}" max="${Math.max(...Object.values(timeSpentByFile))}"></progress>
                    <span>${formatTime(timeSpent)}</span>
                    <details>
                        <summary>Details</summary>
                        <ul>${details}</ul>
                    </details>
                </div>
            `;
		}).join('');

		return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Project Time Tracker</title>
                <style>
                    details > summary {
                        cursor: pointer;
                    }
                    .file-entry {
                        margin-bottom: 1em;
                    }
                </style>
            </head>
            <body>
                <h1>Project Time Tracker</h1>
                ${exportButton}
                ${searchAndFilter}
                ${progressBars}
                <script>
                    const vscode = acquireVsCodeApi();

                    function filterResults() {
                        const searchTerm = document.getElementById('search').value.toLowerCase();
                        document.querySelectorAll('.file-entry').forEach(entry => {
                            const file = entry.getAttribute('data-file').toLowerCase();
                            const users = entry.getAttribute('data-users').toLowerCase();
                            if (file.includes(searchTerm) || users.includes(searchTerm)) {
                                entry.style.display = '';
                            } else {
                                entry.style.display = 'none';
                            }
                        });
                    }

                    function exportData() {
                        vscode.postMessage({ command: 'export' });
                    }
                </script>
            </body>
            </html>
        `;
	}
}
