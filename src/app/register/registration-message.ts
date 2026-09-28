export function getRegistrationMessage(needsEmailConfirmation: boolean, email: string) {
  if (needsEmailConfirmation) {
    return {
      title: "请查收确认邮件",
      body: `我们已向 ${email} 发送确认链接，点击后即可登录。`,
    };
  }

  return {
    title: "注册成功",
    body: `账号 ${email} 已创建，可以直接登录。`,
  };
}
