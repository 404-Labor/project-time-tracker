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

	const logDirPath = path.join(workspaceFolder, '.vscode');
	const logFilePath = path.join(logDirPath, 'time_log.json');
	outputChannel.appendLine(`Log file path: ${logFilePath}`);

	// Überprüfen und ggf. Erstellen des .vscode-Ordners
	if (!fs.existsSync(logDirPath)) {
		fs.mkdirSync(logDirPath);
	}

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

	// Relativen Pfad für die aktive Datei erstellen
	const relativeFilePath = path.relative(workspaceFolder, activeFile);

	if (!logData[activeProject!][relativeFilePath]) {
		logData[activeProject!][relativeFilePath] = [];
	}

	logData[activeProject!][relativeFilePath].push({
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
						this._exportData('json');
						return;
					case 'exportCsv':
						this._exportData('csv');
						return;
				}
			},
			null,
			this._disposables
		);
	}

	private async _exportData(format: 'json' | 'csv') {
		const options: vscode.SaveDialogOptions = {
			saveLabel: `Export as ${format.toUpperCase()}`,
			filters: {
				[format.toUpperCase()]: [format]
			}
		};
		const uri = await vscode.window.showSaveDialog(options);
		if (uri) {
			const logFilePath = path.join(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '', '.vscode/time_log.json');
			if (fs.existsSync(logFilePath)) {
				const logData = fs.readFileSync(logFilePath, 'utf8');
				if (format === 'json') {
					fs.writeFileSync(uri.fsPath, logData, 'utf8');
				} else if (format === 'csv') {
					const csvData = this._convertToCsv(JSON.parse(logData));
					fs.writeFileSync(uri.fsPath, csvData, 'utf8');
				}
				vscode.window.showInformationMessage(`Protokolldaten wurden als ${format.toUpperCase()} exportiert: ${uri.fsPath}`);
			} else {
				vscode.window.showErrorMessage('Keine Protokolldaten gefunden.');
			}
		}
	}

	private _convertToCsv(jsonData: any): string {
		const rows: string[] = [];
		rows.push('Project,File,Date,User,Email,TimeSpent');
		for (const project in jsonData) {
			for (const file in jsonData[project]) {
				for (const entry of jsonData[project][file]) {
					const row = [
						project,
						file,
						entry.date,
						entry.user.name,
						entry.user.email,
						entry.timeSpent
					].join(',');
					rows.push(row);
				}
			}
		}
		return rows.join('\n');
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
		const timeDetailsByFile: { [key: string]: { user: string, totalTime: number, date: string }[] } = {};

		for (const project in logData) {
			for (const file in logData[project]) {
				if (!timeSpentByFile[file]) {
					timeSpentByFile[file] = 0;
				}
				if (!timeDetailsByFile[file]) {
					timeDetailsByFile[file] = [];
				}

				const userTimeMap: { [key: string]: { totalTime: number, dates: string[] } } = {};

				for (const entry of logData[project][file]) {
					const userKey = `${entry.user.name} <${entry.user.email}>`;
					if (!userTimeMap[userKey]) {
						userTimeMap[userKey] = { totalTime: 0, dates: [] };
					}
					userTimeMap[userKey].totalTime += entry.timeSpent;
					userTimeMap[userKey].dates.push(entry.date);
					timeSpentByFile[file] += entry.timeSpent;
				}

				for (const user in userTimeMap) {
					userTimeMap[user].dates.forEach(date => {
						timeDetailsByFile[file].push({
							user,
							totalTime: userTimeMap[user].totalTime,
							date
						});
					});
				}
			}
		}

		const sortedFiles = Object.keys(timeSpentByFile).sort((a, b) => timeSpentByFile[b] - timeSpentByFile[a]);

		this._panel.webview.html = this._getHtmlForWebview(sortedFiles, timeSpentByFile, timeDetailsByFile);
	}

	private _getHtmlForWebview(sortedFiles: string[], timeSpentByFile: { [key: string]: number }, timeDetailsByFile: { [key: string]: { user: string, totalTime: number, date: string }[] }) {

		const totalSpentTime = Object.values(timeSpentByFile).reduce((acc, cur) => acc + cur, 0);

		const progressBars = sortedFiles.map(file => {
			const timeSpent = timeSpentByFile[file];
			const htmlDetails: string[] = [];

			timeDetailsByFile[file].forEach(detail => {
				const html = `<li data-date="${timeDetailsByFile[file].filter(item => item.user === detail.user).map(item => item.date.split('T')[0]).filter((date, index, self) => self.indexOf(date) === index)}" data-time="${detail.totalTime}">${detail.user}: ${formatTime(detail.totalTime)}</li>`;

				if (!htmlDetails.find(item => item.includes(detail.user))) {
					htmlDetails.push(html);
				}
			});

			return `
				<div class="file-entry" data-file="${file.toLowerCase()}" data-users="${timeDetailsByFile[file].map(d => d.user.toLowerCase()).join(', ')}">
					<h3>${file}</h3>
					<progress value="${timeSpent}" max="${Math.max(...Object.values(timeSpentByFile))}"></progress>
					<span>${formatTime(timeSpent)}</span>
					<details>
						<summary>Details</summary>
						<ul>${htmlDetails.join('')}</ul>
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
					input[type="text"], input[type="date"] {
						padding: 10px;
						box-sizing: border-box;
						border: 2px solid #ccc;
						border-radius: 24px;
						margin-right: 10px;
					}
					button {
						padding: 10px 16px;
						border: none;
						border-radius: 24px;
						cursor: pointer;
					}
					button:hover {
						background-color: #f0f0f0;
					}
					button:focus, input[type="text"]:focus, input[type="date"]:focus {
						outline: none;
					}
					.flex-row {
						display: flex;
						flex-direction: row;
						gap: 16px;
					}
				</style>
			</head>
			<body>
				<h1>Project Time Tracker</h1>
				<div class="flex-row">
					<div>
						<input type="text" id="search" placeholder="Search files or users..." oninput="filterResults()">
						<label for="startDate">Start Date:</label>
						<input type="date" id="startDate" onchange="filterResults()">
						<label for="endDate">End Date:</label>
						<input type="date" id="endDate" onchange="filterResults()">
					</div>
					<div class="flex-row">
						<button onclick="exportData()">Export JSON</button>
						<button onclick="exportCsv()">Export CSV</button>
					</div>
				</div>

				<h2>Total Time Spent: ${formatTime(totalSpentTime)}</h2>

				<!-- Placeholder for progress bars -->
				<div id="progressBars">
					${progressBars}
				</div>

				<script>
					const vscode = acquireVsCodeApi();

					function filterResults() {
						const searchTerm = document.getElementById('search').value.toLowerCase();
						const startDateInput = document.getElementById('startDate').value;
						const endDateInput = document.getElementById('endDate').value;

						const startDate = startDateInput ? new Date(startDateInput) : null;
						const endDate = endDateInput ? new Date(endDateInput) : null;

						if (startDate) {
							startDate.setHours(0, 0, 0, 0);
						}
						if (endDate) {
							endDate.setHours(23, 59, 59, 999);
						}

						document.querySelectorAll('.file-entry').forEach(entry => {
							const file = entry.getAttribute('data-file').toLowerCase();
							const users = entry.getAttribute('data-users').toLowerCase();
							const details = entry.querySelectorAll('details ul li');
							let show = false;
							let filteredTimeSpent = 0;

							details.forEach(detail => {
								const user = detail.textContent.split(': ')[0];
								const dateText = detail.getAttribute('data-date');
								const timeSpent = parseInt(detail.getAttribute('data-time'), 10);
								
								const dateRanges = dateText.split(',');
								let userTimeSpent = 0;
								let displayText = '';

								for (const dateRange of dateRanges) {
									const date = new Date(dateRange);
									if ((startDate === null || date >= startDate) && (endDate === null || date <= endDate)) {
										userTimeSpent = timeSpent;
										show = true;
									}
								}

								if (userTimeSpent > 0) {
									displayText =  user +': '+ formatTime(userTimeSpent);
									detail.textContent = displayText;
									filteredTimeSpent += userTimeSpent;
								} else {
									detail.textContent = '';
								}
							});

							entry.querySelector('progress').value = filteredTimeSpent;
							entry.querySelector('span').textContent = formatTime(filteredTimeSpent);

							if (show && (file.includes(searchTerm) || users.includes(searchTerm))) {
								entry.style.display = '';
							} else {
								entry.style.display = 'none';
							}
						});
					}

					function formatTime(seconds) {
						const h = Math.floor(seconds / 3600);
						const m = Math.floor((seconds % 3600) / 60);
						const s = seconds % 60;
						return h + 'h ' + m + 'm ' + s + 's';
					}

					function exportData() {
						vscode.postMessage({ command: 'export' });
					}

					function exportCsv() {
						vscode.postMessage({ command: 'exportCsv' });
					}

					// Initialize the filter results once the document is fully loaded
					document.addEventListener('DOMContentLoaded', (event) => {
						filterResults();
					});
				</script>
			</body>
			</html>
		`;
	}
}