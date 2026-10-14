// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     PaletteExtensions.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI
// =============================================

namespace UI.Components.Features.Palettes;

/// <summary>
///   Conversions between a <see cref="Palette" /> and the <c>palette</c> cookie's lowercase text, and the markup
///   that reads the current Palette.
/// </summary>
// CA1034 flags the compiler-synthesized extension marker type as an externally visible nested type; that type is
// an artifact of the C# 14 extension-member feature itself, not a design choice made here.
#pragma warning disable CA1034
public static class PaletteExtensions
{
	extension(Palette palette)
	{
		/// <summary>
		///   The Palette a visitor who has never chosen one gets: <see cref="Palette.Blue" />, because the restyle's
		///   <c>@theme</c> block maps the accent token to blue.
		/// </summary>
		public static Palette Default => Palette.Blue;

		/// <summary>
		///   Returns the hue whose lowercase name equals <paramref name="value" />, ordinal; anything else,
		///   including <see langword="null" />, is <see cref="Palette.Blue" />.
		/// </summary>
		/// <param name="value">The <c>palette</c> cookie's raw text, or <see langword="null" /> when absent.</param>
		/// <returns>The matching <see cref="Palette" />, or <see cref="Palette.Blue" /> for anything unrecognized.</returns>
		public static Palette FromCookie(string? value)
		{
			foreach (Palette candidate in Enum.GetValues<Palette>())
			{
				if (string.Equals(candidate.ToCookieValue(), value, StringComparison.Ordinal))
				{
					return candidate;
				}
			}

			return Palette.Default;
		}

		/// <summary>
		///   Returns the lowercase name written to the <c>palette</c> cookie, such as <c>"rose"</c>.
		/// </summary>
		/// <returns>The lowercase hue name.</returns>
		public string ToCookieValue()
		{
			// The enum's names are ASCII, so lowercasing them invariantly is exact.
#pragma warning disable CA1308
			return palette.ToString().ToLowerInvariant();
#pragma warning restore CA1308
		}

		/// <summary>
		///   Returns the lowercase name rendered as <c>App.razor</c>'s <c>data-palette</c> attribute, or
		///   <see langword="null" /> for <see cref="Palette.Blue" />, the CSS default, so no attribute is rendered.
		/// </summary>
		/// <returns>The lowercase hue name, or <see langword="null" /> for <see cref="Palette.Blue" />.</returns>
		public string? ToDataPalette()
		{
			return palette == Palette.Default ? null : palette.ToCookieValue();
		}

		/// <summary>
		///   Returns the Tailwind utility class that paints a swatch in this hue's own 500 stop, such as
		///   <c>"bg-rose-500"</c>.
		/// </summary>
		/// <returns>The literal <c>bg-&lt;hue&gt;-500</c> class.</returns>
		public string SwatchClass()
		{
			// Each class is spelled out so the Tailwind scan finds all 17; a class built from the name wouldn't be.
			return palette switch
			{
				Palette.Red => "bg-red-500",
				Palette.Orange => "bg-orange-500",
				Palette.Amber => "bg-amber-500",
				Palette.Yellow => "bg-yellow-500",
				Palette.Lime => "bg-lime-500",
				Palette.Green => "bg-green-500",
				Palette.Emerald => "bg-emerald-500",
				Palette.Teal => "bg-teal-500",
				Palette.Cyan => "bg-cyan-500",
				Palette.Sky => "bg-sky-500",
				Palette.Blue => "bg-blue-500",
				Palette.Indigo => "bg-indigo-500",
				Palette.Violet => "bg-violet-500",
				Palette.Purple => "bg-purple-500",
				Palette.Fuchsia => "bg-fuchsia-500",
				Palette.Pink => "bg-pink-500",
				Palette.Rose => "bg-rose-500",
				_ => throw new ArgumentOutOfRangeException(nameof(palette), palette, "Not a Palette hue."),
			};
		}
	}
}
#pragma warning restore CA1034
