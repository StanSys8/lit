locals {
  project_name = "lit"
  environment  = "dev"
}

output "project_context" {
  description = "Scaffold context for upcoming infrastructure stories."
  value = {
    project_name = local.project_name
    environment  = local.environment
  }
}
