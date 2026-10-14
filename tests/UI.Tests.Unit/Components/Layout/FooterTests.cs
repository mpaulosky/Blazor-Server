// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     FooterTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Unit
// =============================================

using AngleSharp.Dom;

using Domain.Constants;

using Microsoft.Extensions.DependencyInjection;

using UI.Components.Layout;

namespace UI.Tests.Unit.Components.Layout;

public class FooterTests : BunitContext
{
	[Fact]
	public void Render_ShowsAppName()
	{
		// Arrange
		Services.AddSingleton<TimeProvider>(new FixedTimeProvider(new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero)));

		// Act
		IRenderedComponent<Footer> cut = Render<Footer>();

		// Assert
		IElement footer = cut.Find("footer");
		footer.TextContent.Should().Contain(ApplicationConstants.AppName);
	}

	[Theory]
	[InlineData(2024)]
	[InlineData(2031)]
	public void Render_ShowsCopyrightWithYearFromInjectedTimeProvider(int year)
	{
		// Arrange
		Services.AddSingleton<TimeProvider>(new FixedTimeProvider(new DateTimeOffset(year, 6, 15, 0, 0, 0, TimeSpan.Zero)));

		// Act
		IRenderedComponent<Footer> cut = Render<Footer>();

		// Assert
		IElement footer = cut.Find("footer");
		footer.TextContent.Should().Contain($"© {year} · Built with .NET, Blazor and Tailwind CSS");
	}

	private sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider
	{
		public override DateTimeOffset GetUtcNow() => now;
	}
}
