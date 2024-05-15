import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

suite('Extension Test Suite', function () {
	this.timeout(5000);  // Zeitlimit auf 5 Sekunden erhöhen

	vscode.window.showInformationMessage('Start all tests.');

	const logFilePath = path.join(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '', 'time_log.txt');

	// Test, ob die Datei erstellt wird und der Log korrekt ist
	test('Time logging functionality', async () => {
		// Datei löschen, falls sie existiert
		if (fs.existsSync(logFilePath)) {
			fs.unlinkSync(logFilePath);
		}

		// Ein neues Textdokument erstellen
		const document = await vscode.workspace.openTextDocument({ content: 'Test Content' });
		await vscode.window.showTextDocument(document);

		// Kurze Zeit warten, um die Arbeit zu simulieren
		await new Promise(resolve => setTimeout(resolve, 2000));

		// Datei speichern, um die Zeit zu loggen
		await document.save();
		await vscode.commands.executeCommand('workbench.action.closeActiveEditor');

		// Prüfen, ob die Logdatei erstellt wurde
		assert.strictEqual(fs.existsSync(logFilePath), true, 'Log file should exist');

		// Logdatei lesen und prüfen
		const logContent = fs.readFileSync(logFilePath, 'utf8');
		assert.match(logContent, /Time Spent: \d+ ms/, 'Log should contain time spent');
	});
});