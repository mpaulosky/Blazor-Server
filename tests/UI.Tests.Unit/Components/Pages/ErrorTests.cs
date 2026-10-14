// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     ErrorTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Unit
// =============================================

using AngleSharp.Dom;

using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

using UI.Components.Pages;

namespace UI.Tests.Unit.Components.Pages;

public class ErrorTests : BunitContext
{
	private readonly IHostEnvironment _environment = Substitute.For<IHostEnvironment>();

	public ErrorTests()
	{
		Services.AddSingleton(_environment);
	}

	[Fact]
	public void Render_ShowsStatusCodeEyebrow()
	{
		// Arrange

		// Act
		IRenderedComponent<Error> cut = Render<Error>();

		// Assert
		cut.FindAll("*").Should().Contain(element => element.TextContent.Trim() == "500");
	}

	[Fact]
	public void Render_ShowsTitle()
	{
		// Arrange

		// Act
		IRenderedComponent<Error> cut = Render<Error>();

		// Assert
		cut.Find("h1").TextContent.Should().Be("Something went wrong");
	}

	[Fact]
	public void Render_ShowsLead()
	{
		// Arrange

		// Act
		IRenderedComponent<Error> cut = Render<Error>();

		// Assert
		cut.FindAll("p").Should()
			.Contain(element => element.TextContent.Trim() == "Something went wrong on our side.");
	}

	[Fact]
	public void Render_ShowsBackToHomeLink()
	{
		// Arrange

		// Act
		IRenderedComponent<Error> cut = Render<Error>();

		// Assert
		IElement link = cut.Find("a");
		link.GetAttribute("href").Should().Be("");
		link.TextContent.Trim().Should().Be("Back to home");
	}

	[Fact]
	public void Render_WithRequestId_ShowsRequestIdBadge()
	{
		// Arrange
		DefaultHttpContext httpContext = new();

		// Act
		IRenderedComponent<Error> cut = Render<Error>(parameters => parameters.AddCascadingValue(httpContext));

		// Assert
		IElement badge = cut.Find(".font-mono");
		badge.TextContent.Should().Contain(httpContext.TraceIdentifier);
	}

	[Fact]
	public void Render_WithoutRequestId_DoesNotShowRequestIdBadge()
	{
		// Arrange

		// Act
		IRenderedComponent<Error> cut = Render<Error>();

		// Assert
		cut.FindAll(".font-mono").Should().BeEmpty();
	}

	[Fact]
	public void Render_InDevelopment_ShowsDevelopmentModeCard()
	{
		// Arrange
		_environment.EnvironmentName.Returns(Environments.Development);

		// Act
		IRenderedComponent<Error> cut = Render<Error>();

		// Assert
		cut.Markup.Should().Contain("Development Mode");
	}

	[Fact]
	public void Render_InProduction_DoesNotShowDevelopmentModeCard()
	{
		// Arrange
		_environment.EnvironmentName.Returns(Environments.Production);

		// Act
		IRenderedComponent<Error> cut = Render<Error>();

		// Assert
		cut.Markup.Should().NotContain("Development Mode");
	}
}
