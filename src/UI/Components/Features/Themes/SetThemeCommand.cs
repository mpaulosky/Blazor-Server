// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     SetThemeCommand.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI
// =============================================

namespace UI.Components.Features.Themes;

/// <summary>
///   The raw <c>theme</c> form value posted to <see cref="ThemeEndpoints.Path" />.
/// </summary>
/// <param name="Value">The posted value, or <see langword="null" /> when the field was missing.</param>
public sealed record SetThemeCommand(string? Value);
