# Project Time Tracker

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

The Project Time Tracker extension helps you keep track of the time you spend working on different projects and files within Visual Studio Code. This extension is perfect for developers who need to log their working hours or simply want to improve their productivity by analyzing their time management.

![Project Time Tracker Icon](images/icon.png)

## Features

- Automatically tracks the time spent on each file and project.
- Logs the time spent on a file when it is closed or the editor loses focus.
- Saves log data to a `time_log.json` file within your workspace.
- Includes the Git username and email of the user who worked on the file.
- Simple and non-intrusive, integrates smoothly into your workflow.

## How It Works

1. Open a file in your project.
2. The extension starts tracking the time you spend on that file.
3. When you save the file, switch to another file, or lose focus on the editor, the time spent is logged.
4. The log data includes the project name, file name, time spent in seconds, and the Git username and email of the user.

## Installation

1. Open Visual Studio Code.
2. Go to the Extensions view by clicking on the Extensions icon in the Activity Bar on the side of the window.
3. Search for `Project Time Tracker`.
4. Click Install.

## Usage

Simply open and work on your files as usual. The extension will automatically track and log your time. You can view the logs in the `time_log.txt` file located in your workspace directory.

## Example Log

```json
{
  "MyProject": {
    "/path/to/file.ts": [
      {
        "date": "2024-05-15T08:23:08.373Z",
        "user": {
          "name": "John Doe",
          "email": "john.doe@example.com"
        },
        "timeSpent": 123
      },
      {
        "date": "2024-05-15T09:45:10.123Z",
        "user": {
          "name": "Jane Doe",
          "email": "jane.doe@example.com"
        },
        "timeSpent": 45
      }
    ],
    "/path/to/anotherfile.ts": [
      {
        "date": "2024-05-15T10:00:00.000Z",
        "user": {
          "name": "John Doe",
          "email": "john.doe@example.com"
        },
        "timeSpent": 78
      }
    ]
  }
}
```

## Contributing

We welcome feedback and contributions! If you encounter any issues or have suggestions for improvements, please visit our [GitHub repository](https://github.com/your-repo/project-time-tracker) and create an issue or pull request.

## License

This extension is licensed under the [MIT License](https://opensource.org/licenses/MIT).

---

Developed by [404-Labor](https://404-labor.com/)

## Screenshots

Here are some screenshots showing the Project Time Tracker in action:

### Tracking Time in a File

![Tracking Time](images/tracking-time.png)

### Log File

![Log File](images/log-file.png)
