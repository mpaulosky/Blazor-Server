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
	[Fact]
	public void FromCookie_Light_ReturnsLight()
	{
		// Arrange
		const string value = "light";

		// Act
		Theme result = Theme.FromCookie(value);

		// Assert
		result.Should().Be(Theme.Light);
	}

	[Fact]
	public void FromCookie_Dark_ReturnsDark()
	{
		// Arrange
		const string value = "dark";

		// Act
		Theme result = Theme.FromCookie(value);

		// Assert
		result.Should().Be(Theme.Dark);
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

	[Fact]
	public void ToDataTheme_Light_ReturnsLight()
	{
		// Arrange
		const Theme theme = Theme.Light;

		// Act
		string? result = theme.ToDataTheme();

		// Assert
		result.Should().Be("light");
	}

	[Fact]
	public void ToDataTheme_Dark_ReturnsDark()
	{
		// Arrange
		const Theme theme = Theme.Dark;

		// Act
		string? result = theme.ToDataTheme();

		// Assert
		result.Should().Be("dark");
	}

	[Fact]
	public void ToDataTheme_System_ReturnsNull()
	{
		// Arrange
		const Theme theme = Theme.System;

		// Act
		string? result = theme.ToDataTheme();

		// Assert
		result.Should().BeNull();
	}
}
