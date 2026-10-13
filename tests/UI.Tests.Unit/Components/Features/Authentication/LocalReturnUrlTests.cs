// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     LocalReturnUrlTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Unit
// =============================================

using UI.Components.Features.Authentication;

namespace UI.Tests.Unit.Components.Features.Authentication;

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
	public void OrRoot_NonLocalPath_ReturnsRoot(string? returnUrl)
	{
		// Arrange

		// Act
		string result = LocalReturnUrl.OrRoot(returnUrl);

		// Assert
		result.Should().Be("/");
	}
}
