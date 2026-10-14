// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     Palette.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI
// =============================================

namespace UI.Components.Features.Palettes;

/// <summary>
///   The accent-color hue a visitor picks for the Generated App's UI, chosen from Tailwind's hue scales minus the
///   gray family. Members are declared in Tailwind's order, which is also the Palette menu's order.
/// </summary>
public enum Palette
{
	/// <summary>The Tailwind <c>red</c> hue.</summary>
	Red,

	/// <summary>The Tailwind <c>orange</c> hue.</summary>
	Orange,

	/// <summary>The Tailwind <c>amber</c> hue.</summary>
	Amber,

	/// <summary>The Tailwind <c>yellow</c> hue.</summary>
	Yellow,

	/// <summary>The Tailwind <c>lime</c> hue.</summary>
	Lime,

	/// <summary>The Tailwind <c>green</c> hue.</summary>
	Green,

	/// <summary>The Tailwind <c>emerald</c> hue.</summary>
	Emerald,

	/// <summary>The Tailwind <c>teal</c> hue.</summary>
	Teal,

	/// <summary>The Tailwind <c>cyan</c> hue.</summary>
	Cyan,

	/// <summary>The Tailwind <c>sky</c> hue.</summary>
	Sky,

	/// <summary>The Tailwind <c>blue</c> hue, the default: the restyle's <c>@theme</c> block maps the accent to it.</summary>
	Blue,

	/// <summary>The Tailwind <c>indigo</c> hue.</summary>
	Indigo,

	/// <summary>The Tailwind <c>violet</c> hue.</summary>
	Violet,

	/// <summary>The Tailwind <c>purple</c> hue.</summary>
	Purple,

	/// <summary>The Tailwind <c>fuchsia</c> hue.</summary>
	Fuchsia,

	/// <summary>The Tailwind <c>pink</c> hue.</summary>
	Pink,

	/// <summary>The Tailwind <c>rose</c> hue.</summary>
	Rose
}
