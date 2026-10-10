// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     ProjectReferenceRule.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  Architecture.Tests
// =============================================

using System.Reflection;

namespace Architecture.Tests.Rules;

internal static class ProjectReferenceRule
{
	public static IReadOnlyList<string> FindForbiddenProjectReferences(Assembly assembly, IReadOnlySet<string> allowed)
	{
		HashSet<string> projectAssemblyNames = FindProjectAssemblyNames();
		string assemblyName = assembly.GetName().Name ?? string.Empty;

		return assembly.GetReferencedAssemblies()
			.Select(referencedAssembly => referencedAssembly.Name ?? string.Empty)
			.Where(name => projectAssemblyNames.Contains(name))
			.Where(name => (name != assemblyName) && !allowed.Contains(name))
			.ToArray();
	}

	private static HashSet<string> FindProjectAssemblyNames()
	{
		string sourceDirectory = Path.Combine(FindRepositoryRoot(), "src");

		return Directory.EnumerateFiles(sourceDirectory, "*.csproj", SearchOption.AllDirectories)
			.Select(path => Path.GetFileNameWithoutExtension(path))
			.Where(name => name.Length > 0)
			.ToHashSet(StringComparer.Ordinal);
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
