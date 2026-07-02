import { describe, expect, it } from "vitest";
import { translateUiText } from "./zh-ui";

describe("Chinese UI localization", () => {
  it("translates core editor labels", () => {
    expect(translateUiText("AI Stitch")).toBe("AI 拼接");
    expect(translateUiText("Run AI Clip Ordering")).toBe("运行 AI 片段排序");
    expect(translateUiText("Apply Sales Pitch Template")).toBe(
      "应用销售介绍模板",
    );
  });

  it("translates dynamic selection and import labels", () => {
    expect(translateUiText("2/7 filled")).toBe("已填写 2/7");
    expect(translateUiText("3/5 selected")).toBe("已选择 3/5");
    expect(translateUiText("Importing walkaround.mp4 (1/2)...")).toBe(
      "正在导入 walkaround.mp4（1/2）...",
    );
  });
});
