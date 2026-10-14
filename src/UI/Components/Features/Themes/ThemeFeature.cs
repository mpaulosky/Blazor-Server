// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     ThemeFeature.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI
// =============================================

namespace UI.Components.Features.Themes;

/// <summary>
///   Registers the Themes feature: its validator and handler.
/// </summary>
public static class ThemeFeature
{
	/// <summary>
	///   Adds the Themes feature's validator and handler, both singletons.
	/// </summary>
	/// <param name="services">The service collection to add to.</param>
	/// <returns>The same service collection, for chaining.</returns>
	public static IServiceCollection AddThemeFeature(this IServiceCollection services)
	{
		ArgumentNullException.ThrowIfNull(services);

		throw new NotImplementedException();
	}
}
