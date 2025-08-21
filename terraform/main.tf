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
    #!/usr/bin/env bash
    set -euxo pipefail

    # Basic updates
    apt-get update -y

    # Install Docker
    apt-get install -y ca-certificates curl gnupg
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian \
      $(. /etc/os-release && echo $VERSION_CODENAME) stable" > /etc/apt/sources.list.d/docker.list
    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    # Enable Docker at boot
    systemctl enable docker
    systemctl start docker

    # Make a home for app
    useradd -m -s /bin/bash ${var.ssh_username} || true
    mkdir -p /opt/lazycreator
    chown -R ${var.ssh_username}:${var.ssh_username} /opt/lazycreator

    # Install Nginx (as reverse proxy)
    apt-get install -y nginx
    systemctl enable nginx
    systemctl start nginx

    # Placeholder nginx until you push real config
    echo "server { listen 80; server_name _; return 200 'lazycreator placeholder'; }" > /etc/nginx/sites-available/default
    systemctl reload nginx
  EOT

  tags = ["http-server", "https-server"]
}