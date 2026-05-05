# 开发环境和生产环境的 CSS 引用差异

## 背景

这次 AIDH 本地反复出现“页面有内容，但样式丢了”的现象。页面不是 404，也不是 React 组件没有渲染，而是浏览器没有成功加载 CSS。

## 关键现象

页面 HTML 里引用的是开发态 CSS 路径：

```text
/_next/static/css/app/layout.css?...
```

但 `.next/static/css/` 目录里实际存在的是生产构建后的 hash 文件：

```text
.next/static/css/5cb368381ac67431.css
```

浏览器按 HTML 去请求 `/_next/static/css/app/layout.css?...`，结果这个地址返回 404，页面就退化成无样式的原始 HTML。

## 为什么两个路径会不一样

这本身是正常现象。

开发环境通常更重视调试和热更新，CSS 可能使用源码结构或逻辑路径：

```text
/_next/static/css/app/layout.css
/src/style.css?t=...
```

生产环境通常更重视缓存和稳定发布，CSS 会被抽取、压缩、合并，并带上内容 hash：

```text
/_next/static/css/5cb368381ac67431.css
/assets/index-a8f3c9.css
```

hash 文件名的作用是浏览器缓存：内容不变，文件名不变，可以长期缓存；内容变化，hash 变化，浏览器会重新下载。

## 真正的问题

路径不同不是问题。真正的问题是同一次服务里路径映射不自洽：

```text
HTML 引用：/_next/static/css/app/layout.css
实际存在：/_next/static/css/5cb368381ac67431.css
```

也就是 Next 开发服务器的 CSS manifest 和实际 CSS 产物不同步。HTML 按开发态 manifest 输出了逻辑路径，但静态资源目录里只有 hash 文件，导致 CSS 请求 404。

## 为什么容易在 Next dev 中复发

`next dev` 会边改边编译，持续维护：

- RSC/client manifest
- CSS chunk 映射
- webpack dev chunk
- HMR/fast refresh 状态
- `.next` 缓存

当频繁修改 app router、全局 CSS、route handler、Next 配置，或者开发态 overlay 出错时，manifest 和实际产物可能错位。错位后页面 HTML 能正常返回，但 CSS 地址不再可访问。

## 如何判断是不是这个问题

1. 打开页面源码或用 curl 查看 HTML 中的 CSS 地址。
2. 请求这个 CSS 地址，看是否是 200。
3. 查看 `.next/static/css/` 里实际存在的文件。

如果出现这种情况：

```text
HTML 里的 CSS URL 返回 404
.next/static/css/ 里存在另一个 hash CSS 文件
```

就说明不是 CSS 代码丢了，而是开发态 CSS 映射错乱。

## 当前项目处理方式

AIDH 默认预览已改成稳定预览模式：

```bash
npm run dev
```

这个命令现在会执行：

```text
清理 .next
next build
next start
```

稳定预览模式会让 HTML 直接引用真实存在的 hash CSS 文件，避免继续依赖容易错位的 `next dev` 开发态 CSS 映射。

需要注意：如果一个旧的 `next start` 预览进程还在运行，同时又执行了一次新的 `next build`，旧进程内存里的构建信息可能还指向旧 CSS hash，但磁盘上的 `.next/static/css/` 已经被新构建覆盖。这时也会出现：

```text
HTML 引用旧 hash CSS
磁盘上只有新 hash CSS
CSS 请求失败
```

所以重新构建以后，要重启预览服务，保证服务进程和 `.next` 产物是同一批。当前 `npm run dev` 会先清理 `.next` 再构建启动；如果手动单独跑了 `npm run build`，需要重新启动正在运行的预览进程。

如果确实需要热更新开发，再使用：

```bash
npm run dev:hot
```

但在当前项目环境中，日常看页面和验收 UI 优先使用稳定预览模式。

## 总结

开发环境和生产环境的 CSS 路径不一样是正常的。问题不在“不一样”，而在同一个环境里 HTML 引用的 CSS 和服务器实际可访问的 CSS 没有对上。

本次“样式丢了”的根因是：

```text
Next dev 的 CSS manifest 和实际 CSS 产物不同步，导致 HTML 引用的 CSS 地址 404。
```
