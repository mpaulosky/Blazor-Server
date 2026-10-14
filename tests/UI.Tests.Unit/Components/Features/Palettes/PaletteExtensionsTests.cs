// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     PaletteExtensionsTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Unit
// =============================================

using System.Diagnostics.CodeAnalysis;

using UI.Components.Features.Palettes;

namespace UI.Tests.Unit.Components.Features.Palettes;

public class PaletteExtensionsTests
{
	// CA1308 assumes lowercasing is for a security-sensitive comparison; here the lowercase enum name is the
	// expected cookie value itself, which the spec requires to be lowercase.
	[SuppressMessage("Globalization", "CA1308:Normalize strings to uppercase",
		Justification = "The lowercase name is the expected cookie value, not a normalized comparison key.")]
	private static string LowercaseName(Palette hue) => hue.ToString().ToLowerInvariant();

	public static TheoryData<string, Palette> LowercaseNameToHue => new()
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

	public static TheoryData<Palette> AllHues
	{
		get
		{
			TheoryData<Palette> data = new();

			foreach (Palette hue in Enum.GetValues<Palette>())
			{
				data.Add(hue);
			}

			return data;
		}
	}

	public static TheoryData<Palette> AllHuesExceptBlue
	{
		get
		{
			TheoryData<Palette> data = new();

			foreach (Palette hue in Enum.GetValues<Palette>().Where(hue => hue != Palette.Blue))
			{
				data.Add(hue);
			}

			return data;
		}
	}

	[Theory]
	[MemberData(nameof(LowercaseNameToHue))]
	public void FromCookie_KnownLowercaseName_ReturnsThatHue(string cookieValue, Palette expected)
	{
		// Arrange

		// Act
		Palette result = Palette.FromCookie(cookieValue);

		// Assert
		result.Should().Be(expected);
	}

	[Theory]
	[InlineData(null)]
	[InlineData("")]
	[InlineData("Rose")]
	[InlineData("gray")]
	[InlineData("not-a-hue")]
	public void FromCookie_NullEmptyWrongCaseOrUnknownValue_ReturnsBlue(string? cookieValue)
	{
		// Arrange

		// Act
		Palette result = Palette.FromCookie(cookieValue);

		// Assert
		result.Should().Be(Palette.Blue);
	}

	[Theory]
	[MemberData(nameof(AllHues))]
	public void ToCookieValue_EachHue_ReturnsLowercaseNameAndRoundTripsThroughFromCookie(Palette hue)
	{
		// Arrange
		string expectedCookieValue = LowercaseName(hue);

		// Act
		string cookieValue = hue.ToCookieValue();
		Palette roundTripped = Palette.FromCookie(cookieValue);

		// Assert
		cookieValue.Should().Be(expectedCookieValue);
		roundTripped.Should().Be(hue);
	}

	[Fact]
	public void ToDataPalette_Blue_ReturnsNull()
	{
		// Arrange

		// Act
		string? result = Palette.Blue.ToDataPalette();

		// Assert
		result.Should().BeNull();
	}

	[Theory]
	[MemberData(nameof(AllHuesExceptBlue))]
	public void ToDataPalette_NonBlueHue_ReturnsLowercaseNameAndRoundTripsThroughFromCookie(Palette hue)
	{
		// Arrange
		string expected = LowercaseName(hue);

		// Act
		string? result = hue.ToDataPalette();

		// Assert
		result.Should().Be(expected);
		Palette.FromCookie(result).Should().Be(hue);
	}

	[Theory]
	[MemberData(nameof(AllHues))]
	public void SwatchClass_EachHue_ReturnsBgHue500Class(Palette hue)
	{
		// Arrange
		string expected = $"bg-{LowercaseName(hue)}-500";

		// Act
		string result = hue.SwatchClass();

		// Assert
		result.Should().Be(expected);
	}

	[Fact]
	public void Default_ReturnsBlue()
	{
		// Arrange

		// Act
		Palette result = Palette.Default;

		// Assert
		result.Should().Be(Palette.Blue);
	}
}
