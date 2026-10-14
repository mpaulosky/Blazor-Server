// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     BadgeTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Unit
// =============================================

using UI.Components.Shared;

namespace UI.Tests.Unit.Components.Shared;

public class BadgeTests : BunitContext
{
	[Fact]
	public void Render_ChildContent_RendersText()
	{
		// Arrange

		// Act
		IRenderedComponent<Badge> cut = Render<Badge>(parameters => parameters
			.Add(c => c.ChildContent, "Template"));

		// Assert
		cut.Find("span").TextContent.Should().Be("Template");
	}

	[Theory]
	[InlineData(BadgeTone.Neutral, "text-slate-600")]
	[InlineData(BadgeTone.Accent, "text-accent-700")]
	[InlineData(BadgeTone.Sky, "text-sky-700")]
	[InlineData(BadgeTone.Violet, "text-violet-700")]
	[InlineData(BadgeTone.Emerald, "text-emerald-700")]
	[InlineData(BadgeTone.Amber, "text-amber-700")]
	public void Render_Tone_AppliesTheTonesDistinguishingClass(BadgeTone tone, string distinguishingClass)
	{
		// Arrange

		// Act
		IRenderedComponent<Badge> cut = Render<Badge>(parameters => parameters
			.Add(c => c.Tone, tone)
			.Add(c => c.ChildContent, "Template"));

		// Assert
		cut.Find("span").ClassList.Should().Contain(distinguishingClass);
	}

	[Fact]
	public void Render_ClassParameter_AppearsAfterComponentsOwnClasses()
	{
		// Arrange

		// Act
		IRenderedComponent<Badge> cut = Render<Badge>(parameters => parameters
			.Add(c => c.ChildContent, "Template")
			.Add(c => c.Class, "custom-class"));

		// Assert
		string classAttribute = cut.Find("span").GetAttribute("class") ?? string.Empty;
		classAttribute.Should().Contain("custom-class");
		classAttribute.IndexOf("rounded-full", StringComparison.Ordinal).Should()
			.BeLessThan(classAttribute.IndexOf("custom-class", StringComparison.Ordinal));
	}

	[Fact]
	public void Render_UnmatchedAttribute_ReachesRootElement()
	{
		// Arrange

		// Act
		IRenderedComponent<Badge> cut = Render<Badge>(parameters => parameters
			.Add(c => c.ChildContent, "Template")
			.AddUnmatched("data-test", "x"));

		// Assert
		cut.Find("span").GetAttribute("data-test").Should().Be("x");
	}
}
