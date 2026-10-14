// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     SetPaletteCommand.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI
// =============================================

namespace UI.Components.Features.Palettes;

/// <summary>
///   The raw text a visitor posted to <see cref="PaletteEndpoints.Path" />, before validation.
/// </summary>
/// <param name="Value">The posted <c>palette</c> form field, or <see langword="null" /> when missing.</param>
public sealed record SetPaletteCommand(string? Value);
