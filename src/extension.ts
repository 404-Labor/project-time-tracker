import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import simpleGit from 'simple-git';

let startTime: number;
let activeFile: string | undefined;
let activeProject: string | undefined;

const git = simpleGit();

async function getGitUserInfo() {
	try {
		const userName = await git.raw(['config', 'user.name']);
		const userEmail = await git.raw(['config', 'user.email']);
		return { name: userName.trim(), email: userEmail.trim() };
	} catch (error) {
		console.error('Error getting git user info:', error);
		return { name: 'Unknown', email: 'unknown@example.com' };
	}
}

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
async function logTime() {
	const endTime = Date.now();
	const timeSpent = Math.round((endTime - startTime) / 1000); // Zeit in Sekunden

	// Workspace-Verzeichnis ermitteln
	const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
	if (!workspaceFolder) {
		return;
	}

	const { name, email } = await getGitUserInfo();

	const logFilePath = path.join(workspaceFolder, '/.vscode/time_log.json');
	let logData: any = {};

	// Bestehende Log-Daten laden, falls vorhanden
	if (fs.existsSync(logFilePath)) {
		const existingLog = fs.readFileSync(logFilePath, 'utf8');
		logData = JSON.parse(existingLog);
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

export function deactivate() {
	if (activeFile) {
		logTime();
	}
}