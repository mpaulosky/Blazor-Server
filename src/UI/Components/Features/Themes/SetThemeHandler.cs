// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     SetThemeHandler.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI
// =============================================

using Domain.Abstractions;

using FluentValidation;

namespace UI.Components.Features.Themes;

/// <summary>
///   Validates a <see cref="SetThemeCommand" /> and maps its value to a <see cref="Theme" />.
/// </summary>
public sealed class SetThemeHandler
{
	/// <summary>
	///   Initializes a new instance of <see cref="SetThemeHandler" />.
	/// </summary>
	/// <param name="validator">Validates the posted <see cref="SetThemeCommand" />.</param>
	public SetThemeHandler(IValidator<SetThemeCommand> validator)
	{
		ArgumentNullException.ThrowIfNull(validator);

		throw new NotImplementedException();
	}

	/// <summary>
	///   Validates <paramref name="command" /> and, when it's valid, maps it to a <see cref="Theme" />.
	/// </summary>
	/// <param name="command">The posted command.</param>
	/// <returns>
	///   A successful <see cref="Result{T}" /> holding the matching <see cref="Theme" />, or a failed one with
	///   <see cref="ResultErrorCode.Validation" /> and <see cref="Result.Details" /> equal to <c>"Theme.Unknown"</c>.
	/// </returns>
	public Result<Theme> Handle(SetThemeCommand command)
	{
		ArgumentNullException.ThrowIfNull(command);

		throw new NotImplementedException();
	}
}
