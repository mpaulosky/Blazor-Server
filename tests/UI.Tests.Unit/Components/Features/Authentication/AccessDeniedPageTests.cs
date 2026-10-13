// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     AccessDeniedPageTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Unit
// =============================================

using Microsoft.AspNetCore.Http;

using UI.Components.Features.Authentication;

namespace UI.Tests.Unit.Components.Features.Authentication;

public class AccessDeniedPageTests : BunitContext
{
	[Fact]
	public void Render_ShowsAccessDeniedHeading()
	{
		// Arrange
		DefaultHttpContext httpContext = new();

		// Act
		IRenderedComponent<AccessDeniedPage> cut =
			Render<AccessDeniedPage>(parameters => parameters.AddCascadingValue(httpContext));

		// Assert
		cut.Find("h1").TextContent.Should().Be("Access denied");
	}

	[Fact]
	public void OnInitialized_CascadedHttpContext_SetsStatusCodeToForbidden()
	{
		// Arrange
		DefaultHttpContext httpContext = new();

		// Act
		Render<AccessDeniedPage>(parameters => parameters.AddCascadingValue(httpContext));

		// Assert
		httpContext.Response.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
	}
}
