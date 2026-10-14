// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     SetThemeCommandValidatorTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Unit
// =============================================

using FluentValidation.Results;

using UI.Components.Features.Themes;

namespace UI.Tests.Unit.Components.Features.Themes;

public class SetThemeCommandValidatorTests
{
	private readonly SetThemeCommandValidator _sut = new();

	[Theory]
	[InlineData("light")]
	[InlineData("dark")]
	[InlineData("system")]
	public void Validate_AcceptedValue_IsValid(string value)
	{
		// Arrange
		SetThemeCommand command = new(value);

		// Act
		ValidationResult result = _sut.Validate(command);

		// Assert
		result.IsValid.Should().BeTrue();
	}

	[Theory]
	[InlineData("unknown")]
	[InlineData("")]
	[InlineData(null)]
	[InlineData("Dark")]
	public void Validate_UnknownEmptyOrMissingValue_FailsWithThemeUnknownErrorCode(string? value)
	{
		// Arrange
		SetThemeCommand command = new(value);

		// Act
		ValidationResult result = _sut.Validate(command);

		// Assert
		result.IsValid.Should().BeFalse();
		result.Errors.Should().ContainSingle(failure => failure.ErrorCode == "Theme.Unknown");
	}
}
