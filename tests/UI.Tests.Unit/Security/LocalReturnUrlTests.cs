// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     LocalReturnUrlTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Unit
// =============================================

using UI.Security;

namespace UI.Tests.Unit.Security;

public class LocalReturnUrlTests
{
	[Theory]
	[InlineData("/")]
	[InlineData("/profile")]
	[InlineData("/a?b=c#d")]
	public void OrRoot_LocalPath_ReturnsUnchanged(string returnUrl)
	{
		// Arrange

		// Act
		string result = LocalReturnUrl.OrRoot(returnUrl);

		// Assert
		result.Should().Be(returnUrl);
	}

	[Theory]
	[InlineData(null)]
	[InlineData("")]
	[InlineData("   ")]
	[InlineData("~/x")]
	[InlineData("https://evil.example")]
	[InlineData("//evil.example")]
	[InlineData("/\\evil.example")]
	[InlineData("evil.com")]
	[InlineData("javascript:alert(1)")]
	[InlineData("/.//evil.example")]
	public void OrRoot_NonLocalPath_ReturnsRoot(string? returnUrl)
	{
		// Arrange

		// Act
		string result = LocalReturnUrl.OrRoot(returnUrl);

		// Assert
		result.Should().Be("/");
	}

	[Fact]
	public void OrRoot_NonAsciiLocalPath_ReturnsItPercentEncoded()
	{
		// Arrange

		// Act
		string result = LocalReturnUrl.OrRoot("/caf\u00e9?q=\u00fc");

		// Assert
		result.Should().Be("/caf%C3%A9?q=%C3%BC");
	}
}
