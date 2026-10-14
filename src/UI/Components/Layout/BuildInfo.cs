// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     BuildInfo.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI
// =============================================

using System.Diagnostics.CodeAnalysis;

namespace UI.Components.Layout;

/// <summary>
///   The commit, repository, and Release the running build was built from, read from constants embedded at compile
///   time so the UI can show "which build am I looking at?" without calling the GitHub API or running
///   <c>git</c> at runtime.
/// </summary>
/// <param name="Release">
///   The raw <c>git describe --tags --long --match "v[0-9]*"</c> output captured at build time, or empty when
///   <c>git</c>, a <c>.git</c> checkout, or a matching tag wasn't available.
/// </param>
/// <param name="Commit">The full commit SHA the build was built from, or empty when Source Link couldn't determine one.</param>
/// <param name="RepositoryUrl">The repository's HTTPS URL, or empty when Source Link couldn't determine one.</param>
[SuppressMessage("Design", "CA1054:Uri parameters should not be strings",
	Justification = "RepositoryUrl is Source Link's PrivateRepositoryUrl MSBuild property verbatim, and is empty " +
		"outside a git checkout, which System.Uri can't represent.")]
[SuppressMessage("Design", "CA1056:Uri properties should not be strings",
	Justification = "RepositoryUrl is Source Link's PrivateRepositoryUrl MSBuild property verbatim, and is empty " +
		"outside a git checkout, which System.Uri can't represent.")]
public sealed record BuildInfo(string Release, string Commit, string RepositoryUrl);
