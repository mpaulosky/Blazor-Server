// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     ApplicationConstantsTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  Domain.Tests.Unit
// =============================================

using Domain.Constants;

namespace Domain.Tests.Unit.Constants;

public class ApplicationConstantsTests
{
	[Theory]
	[InlineData(ApplicationConstants.AdminPolicy, "AdminOnly")]
	[InlineData(ApplicationConstants.AdminRole, "Admin")]
	[InlineData(ApplicationConstants.ThemeCookie, "theme")]
	[InlineData(ApplicationConstants.PaletteCookie, "palette")]
	[InlineData(ApplicationConstants.Website, "WebApp")]
	public void ApplicationConstants_Member_HasExpectedValue(string actual, string expected)
	{
		// Arrange

		// Act

		// Assert
		actual.Should().Be(expected);
	}
}
