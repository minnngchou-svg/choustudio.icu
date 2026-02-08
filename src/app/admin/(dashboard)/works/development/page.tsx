/** 后台开发作品列表，复用 WorksListClient。 */
import { WorksListClient } from "../WorksListClient"

export default function DevelopmentWorksPage() {
  return (
    <WorksListClient
      workType="development"
      title="开发作品"
      description="管理你的开发 / 开源项目"
    />
  )
}
