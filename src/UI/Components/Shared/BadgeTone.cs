// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     BadgeTone.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI
// =============================================

namespace UI.Components.Shared;

/// <summary>
///   The colour a <see cref="Badge" /> renders.
/// </summary>
public enum BadgeTone
{
	/// <summary>
	///   The default, uncoloured tone.
	/// </summary>
	Neutral,

	/// <summary>
	///   The Palette's accent colour.
	/// </summary>
	Accent,

	/// <summary>
	///   A fixed sky-blue tone.
	/// </summary>
	Sky,

	/// <summary>
	///   A fixed violet tone.
	/// </summary>
	Violet,

	/// <summary>
	///   A fixed emerald tone.
	/// </summary>
	Emerald,

	/// <summary>
	///   A fixed amber tone.
	/// </summary>
	Amber,
}
