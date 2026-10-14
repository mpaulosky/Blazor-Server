// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     RepositoryFiles.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Unit
// =============================================

namespace UI.Tests.Unit;

// Reads source files that never reach the test output, such as stylesheets, from the repository checkout.
internal static class RepositoryFiles
{
	public static string ReadAllText(params string[] pathFromRepositoryRoot)
	{
		string path = Path.Combine([FindRepositoryRoot(), .. pathFromRepositoryRoot]);

		return File.ReadAllText(path);
	}

	private static string FindRepositoryRoot()
	{
		DirectoryInfo? directory = new(AppContext.BaseDirectory);

		while ((directory is not null) && !File.Exists(Path.Combine(directory.FullName, "Directory.Packages.props")))
		{
			directory = directory.Parent;
		}

		return directory?.FullName
			?? throw new InvalidOperationException(
				$"Could not find the repository root (Directory.Packages.props) above '{AppContext.BaseDirectory}'.");
	}
}
