// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     PaletteFeature.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI
// =============================================

using FluentValidation;

namespace UI.Components.Features.Palettes;

/// <summary>
///   Registers the Palette feature: the validator and the handler behind <see cref="PaletteEndpoints.Path" />.
/// </summary>
public static class PaletteFeature
{
	/// <summary>
	///   Adds the Palette feature's validator and handler, both singletons since neither holds state.
	/// </summary>
	/// <param name="services">The service collection to add to.</param>
	/// <returns>The same service collection, for chaining.</returns>
	public static IServiceCollection AddPaletteFeature(this IServiceCollection services)
	{
		services.AddSingleton<IValidator<SetPaletteCommand>, SetPaletteCommandValidator>();
		services.AddSingleton<SetPaletteHandler>();

		return services;
	}
}
