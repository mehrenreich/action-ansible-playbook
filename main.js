const core = require('@actions/core')
const exec = require('@actions/exec')
const yaml = require('yaml')
const fs = require('fs')
const os = require('os')

async function main() {
    try {
        const playbook = core.getInput("playbook", { required: true })
        const python_requirements = core.getInput("python_requirements")
        const requirements = core.getInput("requirements")
        const directory = core.getInput("directory")
        const key = core.getInput("key")
        const inventory = core.getInput("inventory")
        const vaultPassword = core.getInput("vault_password")
        const knownHosts = core.getInput("known_hosts")
        const options = core.getInput("options")
        const sudo    = core.getInput("sudo")
        const noColor = core.getInput("no_color")

        let cmd = ["ansible-playbook", playbook]

        if (options) {
            cmd.push(options.replace(/\n/g, " "))
        }

        if (directory) {
            process.chdir(directory)
            core.saveState("directory", directory)
        }

        if (python_requirements) {
            const pythonRequirementsContent = fs.readFileSync(python_requirements, 'utf8')
            const pythonRequirementsObject = yaml.parse(pythonRequirementsContent)
            await exec.exec("pip3", ["install", "-r", python_requirements])
        }

        if (requirements) {
            const requirementsContent = fs.readFileSync(requirements, 'utf8')
            const requirementsObject = yaml.parse(requirementsContent)

            if (Array.isArray(requirementsObject)) {
                await exec.exec("ansible-galaxy", ["install", "-r", requirements])
            } else {
                if (requirementsObject.roles)
                    await exec.exec("ansible-galaxy", ["role", "install", "-r", requirements])
                if (requirementsObject.collections)
                    await exec.exec("ansible-galaxy", ["collection", "install", "-r", requirements])
            }
        }

        if (key) {
            const keyFile = ".ansible_key"
            fs.writeFileSync(keyFile, key + os.EOL, { mode: 0600 })
            core.saveState("keyFile", keyFile)
            cmd.push("--key-file")
            cmd.push(keyFile)
        }

        if (inventory) {
            const inventoryFile = ".ansible_inventory"
            fs.writeFileSync(inventoryFile, inventory, { mode: 0600 })
            core.saveState("inventoryFile", inventoryFile)
            cmd.push("--inventory-file")
            cmd.push(inventoryFile)
        }

        if (vaultPassword) {
            const vaultPasswordFile = ".ansible_vault_password"
            fs.writeFileSync(vaultPasswordFile, vaultPassword, { mode: 0600 })
            core.saveState("vaultPasswordFile", vaultPasswordFile)
            cmd.push("--vault-password-file")
            cmd.push(vaultPasswordFile)
        }

        if (knownHosts) {
            const knownHostsFile = ".ansible_known_hosts"
            fs.writeFileSync(knownHostsFile, knownHosts, { mode: 0600 })
            core.saveState("knownHostsFile", knownHostsFile)
            cmd.push(`--ssh-common-args="-o UserKnownHostsFile=${knownHostsFile}"`)
            process.env.ANSIBLE_HOST_KEY_CHECKING = "True"
        } else {
            process.env.ANSIBLE_HOST_KEY_CHECKING = "False"
        }

        if (sudo) {
            cmd.unshift("sudo", "-E", "env", `PATH=${process.env.PATH}`)
        }

        if (noColor) {
            process.env.ANSIBLE_NOCOLOR = "True"
        } else {
            process.env.ANSIBLE_FORCE_COLOR = "True"
        }

        let output = ""
        await exec.exec(cmd.join(' '), null, {
          listeners: {
            stdout: function(data) {
              output += data.toString()
            },
            stderr: function(data) {
              output += data.toString()
            }
          }
        })
        core.setOutput("output", output)
    } catch (error) {
        core.setFailed(error.message)
    }
}

main()
