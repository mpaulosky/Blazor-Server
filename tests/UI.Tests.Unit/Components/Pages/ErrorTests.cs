// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     ErrorTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Unit
// =============================================

using UI.Components.Pages;

namespace UI.Tests.Unit.Components.Pages;

public class ErrorTests : BunitContext
{
	[Fact]
	public void Render_ShowsRequestFailedMessage()
	{
		// Arrange

		// Act
		IRenderedComponent<Error> cut = Render<Error>();

		// Assert
		cut.Markup.Should().Contain("An error occurred while processing your request.");
	}
}
