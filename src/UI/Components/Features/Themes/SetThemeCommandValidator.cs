// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     SetThemeCommandValidator.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI
// =============================================

using FluentValidation;

namespace UI.Components.Features.Themes;

/// <summary>
///   Validates that a <see cref="SetThemeCommand" />'s value is exactly <c>light</c>, <c>dark</c> or <c>system</c>.
/// </summary>
public sealed class SetThemeCommandValidator : AbstractValidator<SetThemeCommand>
{
	/// <summary>
	///   Initializes a new instance of <see cref="SetThemeCommandValidator" />.
	/// </summary>
	public SetThemeCommandValidator()
	{
		// The message doesn't echo the posted value, which only a crafted post can make unknown.
		RuleFor(command => command.Value)
			.Must(value => value is "light" or "dark" or "system")
			.WithErrorCode("Theme.Unknown")
			.WithMessage("The Theme must be light, dark or system.");
	}
}
