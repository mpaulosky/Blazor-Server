// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     ThemeExtensionsTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Unit
// =============================================

using UI.Components.Features.Themes;

namespace UI.Tests.Unit.Components.Features.Themes;

public class ThemeExtensionsTests
{
	[Theory]
	[InlineData("light", Theme.Light)]
	[InlineData("dark", Theme.Dark)]
	public void FromCookie_LightOrDark_ReturnsMatchingTheme(string value, Theme expected)
	{
		// Arrange

		// Act
		Theme result = Theme.FromCookie(value);

		// Assert
		result.Should().Be(expected);
	}

	[Theory]
	[InlineData(null)]
	[InlineData("")]
	[InlineData("Dark")]
	[InlineData("Light")]
	[InlineData("system")]
	[InlineData("unknown")]
	public void FromCookie_NullEmptyWrongCaseOrUnknownValue_ReturnsSystem(string? value)
	{
		// Arrange

		// Act
		Theme result = Theme.FromCookie(value);

		// Assert
		result.Should().Be(Theme.System);
	}

	[Theory]
	[InlineData(Theme.Light, "light")]
	[InlineData(Theme.Dark, "dark")]
	[InlineData(Theme.System, null)]
	public void ToDataTheme_EachTheme_ReturnsLowercaseNameOrNullForSystem(Theme theme, string? expected)
	{
		// Arrange

		// Act
		string? result = theme.ToDataTheme();

		// Assert
		result.Should().Be(expected);
	}
}
