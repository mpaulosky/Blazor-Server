// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     StatTileTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Unit
// =============================================

using UI.Components.Shared;

namespace UI.Tests.Unit.Components.Shared;

public class StatTileTests : BunitContext
{
	[Fact]
	public void Render_LabelAndValue_RendersDtAndDd()
	{
		// Arrange

		// Act
		IRenderedComponent<StatTile> cut = Render<StatTile>(parameters => parameters
			.Add(c => c.Label, "Stack")
			.Add(c => c.Value, ".NET 10"));

		// Assert
		cut.Find("dt").TextContent.Should().Be("Stack");
		cut.Find("dd").TextContent.Should().Be(".NET 10");
	}

	[Fact]
	public void Render_ClassParameter_AppearsAfterComponentsOwnClasses()
	{
		// Arrange

		// Act
		IRenderedComponent<StatTile> cut = Render<StatTile>(parameters => parameters
			.Add(c => c.Label, "Stack")
			.Add(c => c.Value, ".NET 10")
			.Add(c => c.Class, "custom-class"));

		// Assert
		string classAttribute = cut.Find("div").GetAttribute("class") ?? string.Empty;
		classAttribute.Should().Contain("custom-class");
		classAttribute.IndexOf("rounded-2xl", StringComparison.Ordinal).Should()
			.BeLessThan(classAttribute.IndexOf("custom-class", StringComparison.Ordinal));
	}

	[Fact]
	public void Render_UnmatchedAttribute_ReachesRootElement()
	{
		// Arrange

		// Act
		IRenderedComponent<StatTile> cut = Render<StatTile>(parameters => parameters
			.Add(c => c.Label, "Stack")
			.Add(c => c.Value, ".NET 10")
			.AddUnmatched("data-test", "x"));

		// Assert
		cut.Find("div").GetAttribute("data-test").Should().Be("x");
	}
}
