terraform {
  required_version = ">= 1.6.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}

# -------- Static IP --------
resource "google_compute_address" "public_ip" {
  name   = "lazycreator-ip"
  region = var.region
}

# -------- VM (free-tier) --------
resource "google_compute_instance" "vm" {
  name         = var.vm_name
  machine_type = var.machine_type
  zone         = var.zone

  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-12"
      size  = 10
      type  = "pd-standard"
    }
  }

  network_interface {
    network = "default"
    access_config { nat_ip = google_compute_address.public_ip.address }
  }

  # Attach your existing service account to the VM
  service_account {
    email  = var.sa_email
    scopes = ["https://www.googleapis.com/auth/cloud-platform"]
  }

  metadata_startup_script = <<-EOT
    #!/bin/bash
    set -e

    # Update package list
    apt-get update -y

    # Install Docker
    apt-get install -y docker.io
    usermod -aG docker $USER

    # Enable and start Docker service
    systemctl enable docker
    systemctl start docker

    # (Optional) Install Docker Compose v2 (built into Docker CLI)
    # Check if already available
    if ! docker compose version >/dev/null 2>&1; then
        apt-get install -y docker-compose
    fi
  EOT

  tags = ["http-server", "https-server"]
}