// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     ThemeExtensions.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI
// =============================================

namespace UI.Components.Features.Themes;

/// <summary>
///   Converts between a <see cref="Theme" /> and the raw text the <c>theme</c> cookie and the <c>data-theme</c>
///   attribute use.
/// </summary>
public static class ThemeExtensions
{
	// CA1034 misreads the extension block's compiler-synthesized marker type as a nested public type; it has no
	// name for a targeted SuppressMessage to bind to, so the warning is disabled for the block instead.
#pragma warning disable CA1034 // Do not nest types
	extension(Theme theme)
	{
		/// <summary>
		///   Maps the <c>theme</c> cookie's raw value to a <see cref="Theme" />: <c>"light"</c> is Light,
		///   <c>"dark"</c> is Dark, and anything else, including <see langword="null" />, is System.
		/// </summary>
		/// <param name="value">The cookie's raw value, or <see langword="null" /> when no cookie was sent.</param>
		/// <returns>The matching <see cref="Theme" />.</returns>
		public static Theme FromCookie(string? value)
		{
			throw new NotImplementedException();
		}

		/// <summary>
		///   Maps this <see cref="Theme" /> to the <c>data-theme</c> attribute's value.
		/// </summary>
		/// <returns><c>"light"</c>, <c>"dark"</c>, or <see langword="null" /> for System, so no attribute is rendered.</returns>
		public string? ToDataTheme()
		{
			throw new NotImplementedException();
		}
	}
#pragma warning restore CA1034 // Do not nest types
}
