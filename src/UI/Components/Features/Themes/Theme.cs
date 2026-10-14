// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     Theme.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI
// =============================================

namespace UI.Components.Features.Themes;

/// <summary>
///   The visitor's chosen rendering mode: Light, Dark, or System (follow the OS <c>prefers-color-scheme</c>).
/// </summary>
public enum Theme
{
	/// <summary>
	///   Follow the OS <c>prefers-color-scheme</c>. The default until the visitor picks a Theme.
	/// </summary>
	System,

	/// <summary>
	///   Always render the light appearance.
	/// </summary>
	Light,

	/// <summary>
	///   Always render the dark appearance.
	/// </summary>
	Dark
}
