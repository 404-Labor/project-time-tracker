import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

let startTime: number;
let activeFile: string | undefined;
let activeProject: string | undefined;

export function activate(context: vscode.ExtensionContext) {
	// Startzeit beim Öffnen einer Datei erfassen
	vscode.workspace.onDidOpenTextDocument((document) => {
		startTime = Date.now();
		activeFile = document.fileName;
		activeProject = vscode.workspace.name;
	});

	// Zeit erfassen, wenn der Editor den Fokus verliert
	vscode.window.onDidChangeWindowState((windowState) => {
		if (!windowState.focused && activeFile) {
			logTime();
		}
	});

	// Zeit erfassen, wenn eine andere Datei geöffnet wird
	vscode.workspace.onDidCloseTextDocument((document) => {
		if (document.fileName === activeFile) {
			logTime();
			activeFile = undefined;
		}
	});

	// Zeit erfassen, wenn VS Code gespeichert wird
	vscode.workspace.onDidSaveTextDocument((document) => {
		if (document.fileName === activeFile) {
			logTime();
			startTime = Date.now();
		}
	});
}

// Funktion, um die Zeit zu protokollieren
function logTime() {
	const endTime = Date.now();
	const timeSpent = endTime - startTime;

	// Workspace-Verzeichnis ermitteln
	const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
	if (!workspaceFolder) {
		return;
	}

	const logFilePath = path.join(workspaceFolder, 'time_log.txt');
	const logData = `Project: ${activeProject}\nFile: ${activeFile}\nTime Spent: ${timeSpent} ms\n\n`;

	fs.appendFileSync(logFilePath, logData, 'utf8');
	startTime = endTime;
}

export function deactivate() {
	if (activeFile) {
		logTime();
	}
}