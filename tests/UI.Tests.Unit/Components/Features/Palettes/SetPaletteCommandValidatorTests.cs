// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     SetPaletteCommandValidatorTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Unit
// =============================================

using FluentValidation.Results;

using UI.Components.Features.Palettes;

namespace UI.Tests.Unit.Components.Features.Palettes;

public class SetPaletteCommandValidatorTests
{
	private readonly SetPaletteCommandValidator _sut = new();

	public static TheoryData<string> ValidPaletteNames => new()
	{
		"red", "orange", "amber", "yellow", "lime", "green", "emerald", "teal", "cyan", "sky", "blue", "indigo",
		"violet", "purple", "fuchsia", "pink", "rose",
	};

	[Theory]
	[MemberData(nameof(ValidPaletteNames))]
	public void Validate_EachOfTheSeventeenHueNames_Succeeds(string value)
	{
		// Arrange
		SetPaletteCommand command = new(value);

		// Act
		ValidationResult result = _sut.Validate(command);

		// Assert
		result.IsValid.Should().BeTrue();
	}

	[Theory]
	[InlineData(null)]
	[InlineData("")]
	[InlineData("Rose")]
	[InlineData("gray")]
	[InlineData("not-a-hue")]
	public void Validate_UnknownEmptyOrMissingValue_FailsWithPaletteUnknownCode(string? value)
	{
		// Arrange
		SetPaletteCommand command = new(value);

		// Act
		ValidationResult result = _sut.Validate(command);

		// Assert
		result.IsValid.Should().BeFalse();
		result.Errors.Should().ContainSingle(failure => failure.ErrorCode == "Palette.Unknown");
	}

	[Fact]
	public void Validate_InvalidValue_ErrorMessageDoesNotEchoThePostedValue()
	{
		// Arrange
		const string value = "not-a-hue";
		SetPaletteCommand command = new(value);

		// Act
		ValidationResult result = _sut.Validate(command);

		// Assert
		result.Errors.Should().AllSatisfy(failure => failure.ErrorMessage.Should().NotContain(value));
	}
}
