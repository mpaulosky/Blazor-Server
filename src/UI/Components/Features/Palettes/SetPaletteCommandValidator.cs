// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     SetPaletteCommandValidator.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI
// =============================================

using FluentValidation;

namespace UI.Components.Features.Palettes;

/// <summary>
///   Accepts exactly the 17 lowercase Tailwind hue names a <see cref="SetPaletteCommand" /> may carry.
/// </summary>
public sealed class SetPaletteCommandValidator : AbstractValidator<SetPaletteCommand>
{
	private static readonly HashSet<string> HueNames =
		Enum.GetValues<Palette>().Select(palette => palette.ToCookieValue()).ToHashSet(StringComparer.Ordinal);

	/// <summary>
	///   Initializes a new instance of <see cref="SetPaletteCommandValidator" />.
	/// </summary>
	public SetPaletteCommandValidator()
	{
		// The message doesn't echo the posted value, so a crafted one isn't reflected back in the 400.
		RuleFor(command => command.Value)
			.Must(value => value is not null && HueNames.Contains(value))
			.WithErrorCode("Palette.Unknown")
			.WithMessage("The Palette must be one of the Tailwind hues.");
	}
}
