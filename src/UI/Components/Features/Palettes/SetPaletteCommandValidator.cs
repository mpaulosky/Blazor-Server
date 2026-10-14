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
	/// <summary>
	///   Initializes a new instance of <see cref="SetPaletteCommandValidator" />.
	/// </summary>
	public SetPaletteCommandValidator()
	{
		throw new NotImplementedException();
	}
}
