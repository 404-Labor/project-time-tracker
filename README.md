# Project Time Tracker

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

The Project Time Tracker extension helps you keep track of the time you spend working on different projects and files within Visual Studio Code. This extension is perfect for developers who need to log their working hours or simply want to improve their productivity by analyzing their time management.

![Project Time Tracker Icon](images/icon.png)

## Features

- Automatically tracks the time spent on each file and project.
- Logs the time spent on a file when it is closed or the editor loses focus.
- Saves log data to a `time_log.txt` file within your workspace.
- Simple and non-intrusive, integrates smoothly into your workflow.

## How It Works

1. Open a file in your project.
2. The extension starts tracking the time you spend on that file.
3. When you save the file, switch to another file, or lose focus on the editor, the time spent is logged.
4. The log data includes the project name, file name, and time spent in milliseconds.

## Installation

1. Open Visual Studio Code.
2. Go to the Extensions view by clicking on the Extensions icon in the Activity Bar on the side of the window.
3. Search for `Project Time Tracker`.
4. Click Install.

## Usage

Simply open and work on your files as usual. The extension will automatically track and log your time. You can view the logs in the `time_log.txt` file located in your workspace directory.
