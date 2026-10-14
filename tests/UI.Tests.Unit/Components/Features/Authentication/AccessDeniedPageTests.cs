// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     AccessDeniedPageTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Unit
// =============================================

using AngleSharp.Dom;

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
	public void Render_ShowsStatusCodeEyebrow()
	{
		// Arrange
		DefaultHttpContext httpContext = new();

		// Act
		IRenderedComponent<AccessDeniedPage> cut =
			Render<AccessDeniedPage>(parameters => parameters.AddCascadingValue(httpContext));

		// Assert
		cut.FindAll("*").Should().Contain(element => element.TextContent.Trim() == "403");
	}

	[Fact]
	public void Render_ShowsLead()
	{
		// Arrange
		DefaultHttpContext httpContext = new();

		// Act
		IRenderedComponent<AccessDeniedPage> cut =
			Render<AccessDeniedPage>(parameters => parameters.AddCascadingValue(httpContext));

		// Assert
		cut.FindAll("p").Should()
			.Contain(element => element.TextContent.Trim() == "You don't have permission to access this page.");
	}

	[Fact]
	public void Render_ShowsBackToHomeLink()
	{
		// Arrange
		DefaultHttpContext httpContext = new();

		// Act
		IRenderedComponent<AccessDeniedPage> cut =
			Render<AccessDeniedPage>(parameters => parameters.AddCascadingValue(httpContext));

		// Assert
		IElement link = cut.Find("a");
		link.GetAttribute("href").Should().Be("");
		link.TextContent.Trim().Should().Be("Back to home");
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
