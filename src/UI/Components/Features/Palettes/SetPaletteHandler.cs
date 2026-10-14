// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     SetPaletteHandler.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI
// =============================================

using Domain.Abstractions;

using FluentValidation;
using FluentValidation.Results;

namespace UI.Components.Features.Palettes;

/// <summary>
///   Validates a <see cref="SetPaletteCommand" /> and maps it to the matching <see cref="Palette" />.
/// </summary>
public sealed class SetPaletteHandler
{
	private readonly IValidator<SetPaletteCommand> _validator;

	/// <summary>
	///   Initializes a new instance of <see cref="SetPaletteHandler" />.
	/// </summary>
	/// <param name="validator">The validator that accepts exactly the 17 lowercase hue names.</param>
	public SetPaletteHandler(IValidator<SetPaletteCommand> validator)
	{
		ArgumentNullException.ThrowIfNull(validator);

		_validator = validator;
	}

	/// <summary>
	///   Validates <paramref name="command" /> and returns the matching <see cref="Palette" />, or a failed
	///   result carrying the validation error code in <see cref="Result.Details" />.
	/// </summary>
	/// <param name="command">The posted Palette command.</param>
	/// <returns>
	///   A successful <see cref="Result{T}" /> holding the <see cref="Palette" />, or a failed one with
	///   <see cref="ResultErrorCode.Validation" /> and <c>Details</c> equal to <c>"Palette.Unknown"</c>.
	/// </returns>
	public Result<Palette> Handle(SetPaletteCommand command)
	{
		ArgumentNullException.ThrowIfNull(command);

		ValidationResult validation = _validator.Validate(command);
		if (!validation.IsValid)
		{
			ValidationFailure error = validation.Errors[0];

			return Result.Fail<Palette>(error.ErrorMessage, ResultErrorCode.Validation, error.ErrorCode);
		}

		return Result.Ok(Palette.FromCookie(command.Value));
	}
}
