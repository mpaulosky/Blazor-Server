// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     SetPaletteHandlerTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Unit
// =============================================

using Domain.Abstractions;

using FluentValidation;
using FluentValidation.Results;

using UI.Components.Features.Palettes;

namespace UI.Tests.Unit.Components.Features.Palettes;

public class SetPaletteHandlerTests
{
	private readonly IValidator<SetPaletteCommand> _validator = Substitute.For<IValidator<SetPaletteCommand>>();
	private readonly SetPaletteHandler _sut;

	public SetPaletteHandlerTests()
	{
		_sut = new SetPaletteHandler(_validator);
	}

	public static TheoryData<string, Palette> ValidValues => new()
	{
		{ "red", Palette.Red },
		{ "orange", Palette.Orange },
		{ "amber", Palette.Amber },
		{ "yellow", Palette.Yellow },
		{ "lime", Palette.Lime },
		{ "green", Palette.Green },
		{ "emerald", Palette.Emerald },
		{ "teal", Palette.Teal },
		{ "cyan", Palette.Cyan },
		{ "sky", Palette.Sky },
		{ "blue", Palette.Blue },
		{ "indigo", Palette.Indigo },
		{ "violet", Palette.Violet },
		{ "purple", Palette.Purple },
		{ "fuchsia", Palette.Fuchsia },
		{ "pink", Palette.Pink },
		{ "rose", Palette.Rose },
	};

	[Theory]
	[MemberData(nameof(ValidValues))]
	public void Handle_ValidatorAccepts_ReturnsSuccessfulResultWithMatchingPalette(string value, Palette expected)
	{
		// Arrange
		SetPaletteCommand command = new(value);
		_validator.Validate(command).Returns(new ValidationResult());

		// Act
		Result<Palette> result = _sut.Handle(command);

		// Assert
		result.Success.Should().BeTrue();
		result.Value.Should().Be(expected);
	}

	[Fact]
	public void Handle_ValidatorRejects_ReturnsFailedResultWithValidationErrorAndPaletteUnknownDetails()
	{
		// Arrange
		SetPaletteCommand command = new("not-a-hue");
		ValidationFailure failure = new(nameof(SetPaletteCommand.Value), "The Palette must be one of the Tailwind hues.")
		{
			ErrorCode = "Palette.Unknown",
		};
		_validator.Validate(command).Returns(new ValidationResult([failure]));

		// Act
		Result<Palette> result = _sut.Handle(command);

		// Assert
		result.Success.Should().BeFalse();
		result.ErrorCode.Should().Be(ResultErrorCode.Validation);
		result.Details.Should().Be("Palette.Unknown");
	}
}
