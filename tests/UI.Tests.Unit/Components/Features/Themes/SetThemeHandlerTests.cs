// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     SetThemeHandlerTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Unit
// =============================================

using Domain.Abstractions;

using FluentValidation;
using FluentValidation.Results;

using UI.Components.Features.Themes;

namespace UI.Tests.Unit.Components.Features.Themes;

public class SetThemeHandlerTests
{
	private readonly IValidator<SetThemeCommand> _validator = Substitute.For<IValidator<SetThemeCommand>>();
	private readonly SetThemeHandler _sut;

	public SetThemeHandlerTests()
	{
		_sut = new SetThemeHandler(_validator);
	}

	[Theory]
	[InlineData("light", Theme.Light)]
	[InlineData("dark", Theme.Dark)]
	[InlineData("system", Theme.System)]
	public void Handle_ValidCommand_ReturnsSuccessfulResultWithMatchingTheme(string value, Theme expected)
	{
		// Arrange
		SetThemeCommand command = new(value);
		_validator.Validate(command).Returns(new ValidationResult());

		// Act
		Result<Theme> result = _sut.Handle(command);

		// Assert
		result.Success.Should().BeTrue();
		result.Value.Should().Be(expected);
	}

	[Fact]
	public void Handle_InvalidCommand_ReturnsFailedResultWithValidationErrorCodeAndThemeUnknownDetails()
	{
		// Arrange
		SetThemeCommand command = new("unknown");
		ValidationFailure failure = new(nameof(SetThemeCommand.Value), "The Theme must be light, dark or system.")
		{
			ErrorCode = "Theme.Unknown",
		};
		_validator.Validate(command).Returns(new ValidationResult([failure]));

		// Act
		Result<Theme> result = _sut.Handle(command);

		// Assert
		result.Success.Should().BeFalse();
		result.ErrorCode.Should().Be(ResultErrorCode.Validation);
		result.Details.Should().Be("Theme.Unknown");
	}
}
