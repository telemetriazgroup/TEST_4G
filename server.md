root@zgroupserver:/home/zgroup1# sudo dmidecode | grep "System Information" -A8
System Information
	Manufacturer: Lenovo
	Product Name: ThinkSystem SR630 -[7X02CTO1WW]-
	Version: 07
	Serial Number: J1005EKT
	UUID: 77c55090-f674-11e7-8887-7ed30aec595f
	Wake-up Type: Power Switch
	SKU Number: 7X02CTO1WW
	Family: ThinkSystem
root@zgroupserver:/home/zgroup1# htop
root@zgroupserver:/home/zgroup1# sudo lshw
zgroupserver                
    description: Rack Mount Chassis
    product: ThinkSystem SR630 -[7X02CTO1WW]- (7X02CTO1WW)
    vendor: Lenovo
    version: 07
    serial: J1005EKT
    width: 64 bits
    capabilities: smbios-3.2.1 dmi-3.2.1 smp vsyscall32
    configuration: boot=normal chassis=rackmount family=ThinkSystem sku=7X02CTO1WW uuid=77c55090-f674-11e7-8887-7ed30aec595f
  *-core
       description: Motherboard
       product: -[7X02CTO1WW]-
       vendor: Lenovo
       physical id: 0
       version: none
       serial: R6SH7BV003G
       slot: none
     *-firmware
          description: BIOS
          vendor: Lenovo
          physical id: 0
          version: -[IVE182M-4.11]-
          date: 07/20/2023
          size: 64KiB
          capacity: 32MiB
          capabilities: pci pnp upgrade shadowing cdboot bootselect edd int14serial acpi usb biosbootspecification uefi
     *-cpu:0
          description: CPU
          product: Intel(R) Xeon(R) Silver 4114 CPU @ 2.20GHz
          vendor: Intel Corp.
          physical id: 40
          bus info: cpu@0
          version: 6.85.4
          slot: CPU 1
          size: 2200MHz
          capacity: 3GHz
          width: 64 bits
          clock: 100MHz
          capabilities: lm fpu fpu_exception wp vme de pse tsc msr pae mce cx8 apic sep mtrr pge mca cmov pat pse36 clflush dts acpi mmx fxsr sse sse2 ss ht tm pbe syscall nx pdpe1gb rdtscp x86-64 constant_tsc art arch_perfmon pebs bts rep_good nopl xtopology nonstop_tsc cpuid aperfmperf pni pclmulqdq dtes64 monitor ds_cpl vmx smx est tm2 ssse3 sdbg fma cx16 xtpr pdcm pcid dca sse4_1 sse4_2 x2apic movbe popcnt tsc_deadline_timer aes xsave avx f16c rdrand lahf_lm abm 3dnowprefetch cpuid_fault epb cat_l3 cdp_l3 invpcid_single pti intel_ppin ssbd mba ibrs ibpb stibp tpr_shadow vnmi flexpriority ept vpid ept_ad fsgsbase tsc_adjust bmi1 hle avx2 smep bmi2 erms invpcid rtm cqm mpx rdt_a avx512f avx512dq rdseed adx smap clflushopt clwb intel_pt avx512cd avx512bw avx512vl xsaveopt xsavec xgetbv1 xsaves cqm_llc cqm_occup_llc cqm_mbm_total cqm_mbm_local dtherm ida arat pln pts hwp_epp pku ospke md_clear flush_l1d arch_capabilities
          configuration: cores=10 enabledcores=10 microcode=33583110 threads=20
        *-cache:0
             description: L1 cache
             physical id: 3d
             slot: L1-Cache
             size: 640KiB
             capacity: 640KiB
             capabilities: synchronous internal write-back instruction
             configuration: level=1
        *-cache:1
             description: L2 cache
             physical id: 3e
             slot: L2-Cache
             size: 10MiB
             capacity: 10MiB
             capabilities: synchronous internal varies unified
             configuration: level=2
        *-cache:2
             description: L3 cache
             physical id: 3f
             slot: L3-Cache
             size: 13MiB
             capacity: 13MiB
             capabilities: synchronous internal varies unified
             configuration: level=3
     *-cpu:1
          description: CPU
          product: Intel(R) Xeon(R) Silver 4114 CPU @ 2.20GHz
          vendor: Intel Corp.
          physical id: 44
          bus info: cpu@1
          version: 6.85.4
          slot: CPU 2
          size: 2200MHz
          capacity: 3GHz
          width: 64 bits
          clock: 100MHz
          capabilities: lm fpu fpu_exception wp vme de pse tsc msr pae mce cx8 apic sep mtrr pge mca cmov pat pse36 clflush dts acpi mmx fxsr sse sse2 ss ht tm pbe syscall nx pdpe1gb rdtscp x86-64 constant_tsc art arch_perfmon pebs bts rep_good nopl xtopology nonstop_tsc cpuid aperfmperf pni pclmulqdq dtes64 monitor ds_cpl vmx smx est tm2 ssse3 sdbg fma cx16 xtpr pdcm pcid dca sse4_1 sse4_2 x2apic movbe popcnt tsc_deadline_timer aes xsave avx f16c rdrand lahf_lm abm 3dnowprefetch cpuid_fault epb cat_l3 cdp_l3 invpcid_single pti intel_ppin ssbd mba ibrs ibpb stibp tpr_shadow vnmi flexpriority ept vpid ept_ad fsgsbase tsc_adjust bmi1 hle avx2 smep bmi2 erms invpcid rtm cqm mpx rdt_a avx512f avx512dq rdseed adx smap clflushopt clwb intel_pt avx512cd avx512bw avx512vl xsaveopt xsavec xgetbv1 xsaves cqm_llc cqm_occup_llc cqm_mbm_total cqm_mbm_local dtherm ida arat pln pts hwp_epp pku ospke md_clear flush_l1d arch_capabilities
          configuration: cores=10 enabledcores=10 microcode=33583110 threads=20
        *-cache:0
             description: L1 cache
             physical id: 41
             slot: L1-Cache
             size: 640KiB
             capacity: 640KiB
             capabilities: synchronous internal write-back instruction
             configuration: level=1
        *-cache:1
             description: L2 cache
             physical id: 42
             slot: L2-Cache
             size: 10MiB
             capacity: 10MiB
             capabilities: synchronous internal varies unified
             configuration: level=2
        *-cache:2
             description: L3 cache
             physical id: 43
             slot: L3-Cache
             size: 13MiB
             capacity: 13MiB
             capabilities: synchronous internal varies unified
             configuration: level=3
     *-memory
          description: System Memory
          physical id: 20
          slot: System board or motherboard
          size: 64GiB
          capacity: 7680GiB
          capabilities: ecc
          configuration: errordetection=ecc
        *-bank:0
             description: DIMM DDR4 Synchronous Registered (Buffered) 2666 MHz (0,4 ns)
             product: 9ASF1G72PZ-2G6B1
             vendor: Micron Technology
             physical id: 0
             serial: 002C0F1735188228AB
             slot: DIMM 5
             size: 8GiB
             width: 64 bits
             clock: 2666MHz (0.4ns)
        *-bank:1
             description: [empty]
             product: NO DIMM
             vendor: NO DIMM
             physical id: 1
             serial: NO DIMM
             slot: DIMM 6
        *-bank:2
             description: DIMM DDR4 Synchronous Registered (Buffered) 2666 MHz (0,4 ns)
             product: 9ASF1G72PZ-2G6B1
             vendor: Micron Technology
             physical id: 2
             serial: 002C0F17351882282F
             slot: DIMM 3
             size: 8GiB
             width: 64 bits
             clock: 2666MHz (0.4ns)
        *-bank:3
             description: [empty]
             product: NO DIMM
             vendor: NO DIMM
             physical id: 3
             serial: NO DIMM
             slot: DIMM 4
        *-bank:4
             description: [empty]
             product: NO DIMM
             vendor: NO DIMM
             physical id: 4
             serial: NO DIMM
             slot: DIMM 1
        *-bank:5
             description: [empty]
             product: NO DIMM
             vendor: NO DIMM
             physical id: 5
             serial: NO DIMM
             slot: DIMM 2
        *-bank:6
             description: DIMM DDR4 Synchronous Registered (Buffered) 2666 MHz (0,4 ns)
             product: 9ASF1G72PZ-2G6B1
             vendor: Micron Technology
             physical id: 6
             serial: 002C0F173518822711
             slot: DIMM 8
             size: 8GiB
             width: 64 bits
             clock: 2666MHz (0.4ns)
        *-bank:7
             description: [empty]
             product: NO DIMM
             vendor: NO DIMM
             physical id: 7
             serial: NO DIMM
             slot: DIMM 7
        *-bank:8
             description: DIMM DDR4 Synchronous Registered (Buffered) 2666 MHz (0,4 ns)
             product: 9ASF1G72PZ-2G6B1
             vendor: Micron Technology
             physical id: 8
             serial: 002C0F1735188227CC
             slot: DIMM 10
             size: 8GiB
             width: 64 bits
             clock: 2666MHz (0.4ns)
        *-bank:9
             description: [empty]
             product: NO DIMM
             vendor: NO DIMM
             physical id: 9
             serial: NO DIMM
             slot: DIMM 9
        *-bank:10
             description: [empty]
             product: NO DIMM
             vendor: NO DIMM
             physical id: a
             serial: NO DIMM
             slot: DIMM 12
        *-bank:11
             description: [empty]
             product: NO DIMM
             vendor: NO DIMM
             physical id: b
             serial: NO DIMM
             slot: DIMM 11
        *-bank:12
             description: DIMM DDR4 Synchronous Registered (Buffered) 2666 MHz (0,4 ns)
             product: 9ASF1G72PZ-2G6B1
             vendor: Micron Technology
             physical id: c
             serial: 002C0F17351882279E
             slot: DIMM 17
             size: 8GiB
             width: 64 bits
             clock: 2666MHz (0.4ns)
        *-bank:13
             description: [empty]
             product: NO DIMM
             vendor: NO DIMM
             physical id: d
             serial: NO DIMM
             slot: DIMM 18
        *-bank:14
             description: DIMM DDR4 Synchronous Registered (Buffered) 2666 MHz (0,4 ns)
             product: 9ASF1G72PZ-2G6B1
             vendor: Micron Technology
             physical id: e
             serial: 002C0F1735188227A1
             slot: DIMM 15
             size: 8GiB
             width: 64 bits
             clock: 2666MHz (0.4ns)
        *-bank:15
             description: [empty]
             product: NO DIMM
             vendor: NO DIMM
             physical id: f
             serial: NO DIMM
             slot: DIMM 16
        *-bank:16
             description: [empty]
             product: NO DIMM
             vendor: NO DIMM
             physical id: 10
             serial: NO DIMM
             slot: DIMM 13
        *-bank:17
             description: [empty]
             product: NO DIMM
             vendor: NO DIMM
             physical id: 11
             serial: NO DIMM
             slot: DIMM 14
        *-bank:18
             description: DIMM DDR4 Synchronous Registered (Buffered) 2666 MHz (0,4 ns)
             product: 9ASF1G72PZ-2G6B1
             vendor: Micron Technology
             physical id: 12
             serial: 002C0F173518822497
             slot: DIMM 20
             size: 8GiB
             width: 64 bits
             clock: 2666MHz (0.4ns)
        *-bank:19
             description: [empty]
             product: NO DIMM
             vendor: NO DIMM
             physical id: 13
             serial: NO DIMM
             slot: DIMM 19
        *-bank:20
             description: DIMM DDR4 Synchronous Registered (Buffered) 2666 MHz (0,4 ns)
             product: 9ASF1G72PZ-2G6B1
             vendor: Micron Technology
             physical id: 14
             serial: 002C0F1735188226D4
             slot: DIMM 22
             size: 8GiB
             width: 64 bits
             clock: 2666MHz (0.4ns)
        *-bank:21
             description: [empty]
             product: NO DIMM
             vendor: NO DIMM
             physical id: 15
             serial: NO DIMM
             slot: DIMM 21
        *-bank:22
             description: [empty]
             product: NO DIMM
             vendor: NO DIMM
             physical id: 16
             serial: NO DIMM
             slot: DIMM 24
        *-bank:23
             description: [empty]
             product: NO DIMM
             vendor: NO DIMM
             physical id: 17
             serial: NO DIMM
             slot: DIMM 23
     *-pci:0
          description: Host bridge
          product: Sky Lake-E DMI3 Registers
          vendor: Intel Corporation
          physical id: 100
          bus info: pci@0000:00:00.0
          version: 04
          width: 32 bits
          clock: 33MHz
        *-generic:0
             description: System peripheral
             product: Sky Lake-E CBDMA Registers
             vendor: Intel Corporation
             physical id: 4
             bus info: pci@0000:00:04.0
             logical name: /dev/fb0
             version: 04
             width: 64 bits
             clock: 33MHz
             capabilities: msix pciexpress pm bus_master cap_list fb
             configuration: depth=32 driver=ioatdma latency=0 mode=1024x768 visual=truecolor xres=1024 yres=768
             resources: iomemory:20f0-20ef irq:524 memory:20ffff2c000-20ffff2ffff
        *-generic:1
             description: System peripheral
             product: Sky Lake-E CBDMA Registers
             vendor: Intel Corporation
             physical id: 4.1
             bus info: pci@0000:00:04.1
             version: 04
             width: 64 bits
             clock: 33MHz
             capabilities: msix pciexpress pm bus_master cap_list
             configuration: driver=ioatdma latency=0
             resources: iomemory:20f0-20ef irq:526 memory:20ffff28000-20ffff2bfff
        *-generic:2
             description: System peripheral
             product: Sky Lake-E CBDMA Registers
             vendor: Intel Corporation
             physical id: 4.2
             bus info: pci@0000:00:04.2
             version: 04
             width: 64 bits
             clock: 33MHz
             capabilities: msix pciexpress pm bus_master cap_list
             configuration: driver=ioatdma latency=0
             resources: iomemory:20f0-20ef irq:524 memory:20ffff24000-20ffff27fff
        *-generic:3
             description: System peripheral
             product: Sky Lake-E CBDMA Registers
             vendor: Intel Corporation
             physical id: 4.3
             bus info: pci@0000:00:04.3
             version: 04
             width: 64 bits
             clock: 33MHz
             capabilities: msix pciexpress pm bus_master cap_list
             configuration: driver=ioatdma latency=0
             resources: iomemory:20f0-20ef irq:526 memory:20ffff20000-20ffff23fff
        *-generic:4
             description: System peripheral
             product: Sky Lake-E CBDMA Registers
             vendor: Intel Corporation
             physical id: 4.4
             bus info: pci@0000:00:04.4
             version: 04
             width: 64 bits
             clock: 33MHz
             capabilities: msix pciexpress pm bus_master cap_list
             configuration: driver=ioatdma latency=0
             resources: iomemory:20f0-20ef irq:524 memory:20ffff1c000-20ffff1ffff
        *-generic:5
             description: System peripheral
             product: Sky Lake-E CBDMA Registers
             vendor: Intel Corporation
             physical id: 4.5
             bus info: pci@0000:00:04.5
             version: 04
             width: 64 bits
             clock: 33MHz
             capabilities: msix pciexpress pm bus_master cap_list
             configuration: driver=ioatdma latency=0
             resources: iomemory:20f0-20ef irq:526 memory:20ffff18000-20ffff1bfff
        *-generic:6
             description: System peripheral
             product: Sky Lake-E CBDMA Registers
             vendor: Intel Corporation
             physical id: 4.6
             bus info: pci@0000:00:04.6
             version: 04
             width: 64 bits
             clock: 33MHz
             capabilities: msix pciexpress pm bus_master cap_list
             configuration: driver=ioatdma latency=0
             resources: iomemory:20f0-20ef irq:524 memory:20ffff14000-20ffff17fff
        *-generic:7
             description: System peripheral
             product: Sky Lake-E CBDMA Registers
             vendor: Intel Corporation
             physical id: 4.7
             bus info: pci@0000:00:04.7
             version: 04
             width: 64 bits
             clock: 33MHz
             capabilities: msix pciexpress pm bus_master cap_list
             configuration: driver=ioatdma latency=0
             resources: iomemory:20f0-20ef irq:526 memory:20ffff10000-20ffff13fff
        *-generic:8 UNCLAIMED
             description: System peripheral
             product: Sky Lake-E MM/Vt-d Configuration Registers
             vendor: Intel Corporation
             physical id: 5
             bus info: pci@0000:00:05.0
             version: 04
             width: 32 bits
             clock: 33MHz
             capabilities: pciexpress cap_list
             configuration: latency=0
        *-generic:9 UNCLAIMED
             description: System peripheral
             product: Sky Lake-E RAS
             vendor: Intel Corporation
             physical id: 5.2
             bus info: pci@0000:00:05.2
             version: 04
             width: 32 bits
             clock: 33MHz
             capabilities: pciexpress cap_list
             configuration: latency=0
        *-generic:10 UNCLAIMED
             description: PIC
             product: Sky Lake-E IOAPIC
             vendor: Intel Corporation
             physical id: 5.4
             bus info: pci@0000:00:05.4
             version: 04
             width: 32 bits
             clock: 33MHz
             capabilities: pciexpress pm io_x_-apic bus_master cap_list
             configuration: latency=0
             resources: memory:d4d1a000-d4d1afff
        *-generic:11 UNCLAIMED
             description: System peripheral
             product: Sky Lake-E Ubox Registers
             vendor: Intel Corporation
             physical id: 8
             bus info: pci@0000:00:08.0
             version: 04
             width: 32 bits
             clock: 33MHz
             capabilities: pciexpress cap_list
             configuration: latency=0
        *-generic:12 UNCLAIMED
             description: Performance counters
             product: Sky Lake-E Ubox Registers
             vendor: Intel Corporation
             physical id: 8.1
             bus info: pci@0000:00:08.1
             version: 04
             width: 32 bits
             clock: 33MHz
             configuration: latency=0
        *-generic:13 UNCLAIMED
             description: System peripheral
             product: Sky Lake-E Ubox Registers
             vendor: Intel Corporation
             physical id: 8.2
             bus info: pci@0000:00:08.2
             version: 04
             width: 32 bits
             clock: 33MHz
             capabilities: pciexpress cap_list
             configuration: latency=0
        *-generic:14 UNCLAIMED
             description: Unassigned class
             product: C620 Series Chipset Family MROM 0
             vendor: Intel Corporation
             physical id: 11
             bus info: pci@0000:00:11.0
             version: 09
             width: 32 bits
             clock: 33MHz
             capabilities: pm cap_list
             configuration: latency=0
        *-sata:0
             description: SATA controller
             product: C620 Series Chipset Family SSATA Controller [AHCI mode]
             vendor: Intel Corporation
             physical id: 11.5
             bus info: pci@0000:00:11.5
             version: 09
             width: 32 bits
             clock: 66MHz
             capabilities: sata msi pm ahci_1.0 bus_master cap_list
             configuration: driver=ahci latency=0
             resources: irq:36 memory:d4d16000-d4d17fff memory:d4d19000-d4d190ff ioport:2070(size=8) ioport:2060(size=4) ioport:2020(size=32) memory:d4c80000-d4cfffff
        *-usb
             description: USB controller
             product: C620 Series Chipset Family USB 3.0 xHCI Controller
             vendor: Intel Corporation
             physical id: 14
             bus info: pci@0000:00:14.0
             version: 09
             width: 64 bits
             clock: 33MHz
             capabilities: pm msi xhci bus_master cap_list
             configuration: driver=xhci_hcd latency=0
             resources: iomemory:20f0-20ef irq:35 memory:20ffff00000-20ffff0ffff
           *-usbhost:0
                product: xHCI Host Controller
                vendor: Linux 5.15.0-97-generic xhci-hcd
                physical id: 0
                bus info: usb@1
                logical name: usb1
                version: 5.15
                capabilities: usb-2.00
                configuration: driver=hub slots=16 speed=480Mbit/s
              *-usb
                   description: USB hub
                   product: Emulex Pilot4 HighSpeed HUB
                   vendor: Emulex Communications
                   physical id: 1
                   bus info: usb@1:1
                   version: 1.00
                   serial: 0xBABEFACE
                   capabilities: usb-2.00
                   configuration: driver=hub maxpower=100mA slots=7 speed=480Mbit/s
                 *-usb DISABLED
                      description: Ethernet interface
                      product: XClarity Controller
                      vendor: IBM
                      physical id: 6
                      bus info: usb@1:1.6
                      logical name: enx7ed30aec595f
                      version: 4.14
                      serial: 7e:d3:0a:ec:59:5f
                      capabilities: usb-2.00 ethernet physical
                      configuration: autonegotiation=off broadcast=yes driver=cdc_ether driverversion=5.15.0-97-generic duplex=half firmware=CDC Ethernet Device link=no multicast=yes port=twisted pair speed=480Mbit/s
           *-usbhost:1
                product: xHCI Host Controller
                vendor: Linux 5.15.0-97-generic xhci-hcd
                physical id: 1
                bus info: usb@2
                logical name: usb2
                version: 5.15
                capabilities: usb-3.00
                configuration: driver=hub slots=10 speed=5000Mbit/s
              *-usb
                   description: Mass storage device
                   product: XS1000
                   vendor: Kingston
                   physical id: 4
                   bus info: usb@2:4
                   logical name: scsi16
                   version: 1.00
                   serial: 50026B72833C2A69
                   capabilities: usb-3.20 scsi
                   configuration: driver=uas maxpower=896mA speed=5000Mbit/s
                 *-disk
                      description: SCSI Disk
                      product: XS1000
                      vendor: Kingston
                      physical id: 0.0.0
                      bus info: scsi@16:0.0.0
                      logical name: /dev/sdd
                      version: 1000
                      serial: 50026B72833C2A69
                      size: 931GiB (1TB)
                      capabilities: partitioned partitioned:dos
                      configuration: ansiversion=6 logicalsectorsize=512 sectorsize=512 signature=6a161e33
                    *-volume
                         description: HPFS/NTFS partition
                         physical id: 1
                         bus info: scsi@16:0.0.0,1
                         logical name: /dev/sdd1
                         capacity: 931GiB
                         capabilities: primary
        *-generic:15
             description: Signal processing controller
             product: C620 Series Chipset Family Thermal Subsystem
             vendor: Intel Corporation
             physical id: 14.2
             bus info: pci@0000:00:14.2
             version: 09
             width: 64 bits
             clock: 33MHz
             capabilities: pm msi cap_list
             configuration: driver=intel_pch_thermal latency=0
             resources: iomemory:20f0-20ef irq:18 memory:20ffff33000-20ffff33fff
        *-communication:0 UNCLAIMED
             description: Communication controller
             product: C620 Series Chipset Family MEI Controller #1
             vendor: Intel Corporation
             physical id: 16
             bus info: pci@0000:00:16.0
             version: 09
             width: 64 bits
             clock: 33MHz
             capabilities: pm msi bus_master cap_list
             configuration: latency=0
             resources: iomemory:20f0-20ef memory:20ffff32000-20ffff32fff
        *-communication:1 UNCLAIMED
             description: Communication controller
             product: C620 Series Chipset Family MEI Controller #2
             vendor: Intel Corporation
             physical id: 16.1
             bus info: pci@0000:00:16.1
             version: 09
             width: 64 bits
             clock: 33MHz
             capabilities: pm msi bus_master cap_list
             configuration: latency=0
             resources: iomemory:20f0-20ef memory:20ffff31000-20ffff31fff
        *-communication:2 UNCLAIMED
             description: Communication controller
             product: C620 Series Chipset Family MEI Controller #3
             vendor: Intel Corporation
             physical id: 16.4
             bus info: pci@0000:00:16.4
             version: 09
             width: 64 bits
             clock: 33MHz
             capabilities: pm msi bus_master cap_list
             configuration: latency=0
             resources: iomemory:20f0-20ef memory:20ffff30000-20ffff30fff
        *-sata:1
             description: SATA controller
             product: C620 Series Chipset Family SATA Controller [AHCI mode]
             vendor: Intel Corporation
             physical id: 17
             bus info: pci@0000:00:17.0
             version: 09
             width: 32 bits
             clock: 66MHz
             capabilities: sata msi pm ahci_1.0 bus_master cap_list
             configuration: driver=ahci latency=0
             resources: irq:178 memory:d4d14000-d4d15fff memory:d4d18000-d4d180ff ioport:2050(size=8) ioport:2040(size=4) ioport:2000(size=32) memory:d4c00000-d4c7ffff
        *-pci
             description: PCI bridge
             product: C620 Series Chipset Family PCI Express Root Port #1
             vendor: Intel Corporation
             physical id: 1c
             bus info: pci@0000:00:1c.0
             version: f9
             width: 32 bits
             clock: 33MHz
             capabilities: pci pciexpress msi pm normal_decode bus_master cap_list
             configuration: driver=pcieport
             resources: irq:24 memory:d3000000-d4bfffff
           *-pci
                description: PCI bridge
                product: x1 PCIe Gen2 Bridge[Pilot4]
                vendor: Emulex Corporation
                physical id: 0
                bus info: pci@0000:01:00.0
                version: 00
                width: 64 bits
                clock: 33MHz
                capabilities: pci pm msi pciexpress normal_decode bus_master cap_list
                resources: memory:d4b00000-d4b00fff memory:d3000000-d4afffff
              *-display
                   description: VGA compatible controller
                   product: MGA G200e [Pilot] ServerEngines (SEP1)
                   vendor: Matrox Electronics Systems Ltd.
                   physical id: 0
                   bus info: pci@0000:02:00.0
                   logical name: /dev/fb0
                   version: 42
                   width: 32 bits
                   clock: 33MHz
                   capabilities: pm msi vga_controller bus_master cap_list rom fb
                   configuration: depth=32 driver=mgag200 latency=0 resolution=1024,768
                   resources: irq:16 memory:d3000000-d3ffffff memory:d4a10000-d4a13fff memory:d4000000-d47fffff memory:d4a00000-d4a0ffff
        *-isa
             description: ISA bridge
             product: C624 Series Chipset LPC/eSPI Controller
             vendor: Intel Corporation
             physical id: 1f
             bus info: pci@0000:00:1f.0
             version: 09
             width: 32 bits
             clock: 33MHz
             capabilities: isa
             configuration: latency=0
           *-pnp00:00
                product: PnP device PNP0b00
                physical id: 0
                capabilities: pnp
                configuration: driver=rtc_cmos
           *-pnp00:01
                product: PnP device PNP0c02
                physical id: 1
                capabilities: pnp
                configuration: driver=system
           *-pnp00:02
                product: PnP device PNP0c02
                physical id: 2
                capabilities: pnp
                configuration: driver=system
           *-pnp00:03
                product: PnP device PNP0501
                physical id: 3
                capabilities: pnp
                configuration: driver=serial
           *-pnp00:04
                product: PnP device PNP0501
                physical id: 4
                capabilities: pnp
                configuration: driver=serial
           *-pnp00:05
                product: PnP device IPI0001
                physical id: 5
                capabilities: pnp
                configuration: driver=system
           *-pnp00:06
                product: PnP device PNP0c02
                physical id: 6
                capabilities: pnp
                configuration: driver=system
           *-pnp00:07
                product: PnP device PNP0c02
                physical id: 7
                capabilities: pnp
                configuration: driver=system
           *-pnp00:08
                product: PnP device PNP0c02
                physical id: 8
                capabilities: pnp
                configuration: driver=system
           *-pnp00:09
                product: PnP device PNP0c02
                physical id: 9
                capabilities: pnp
                configuration: driver=system
           *-pnp00:0a
                product: PnP device PNP0c31
                physical id: a
                capabilities: pnp
                configuration: driver=tpm_tis
        *-memory UNCLAIMED
             description: Memory controller
             product: C620 Series Chipset Family Power Management Controller
             vendor: Intel Corporation
             physical id: 1f.2
             bus info: pci@0000:00:1f.2
             version: 09
             width: 32 bits
             clock: 33MHz (30.3ns)
             configuration: latency=0
             resources: memory:d4d10000-d4d13fff
        *-serial:0
             description: SMBus
             product: C620 Series Chipset Family SMBus
             vendor: Intel Corporation
             physical id: 1f.4
             bus info: pci@0000:00:1f.4
             version: 09
             width: 64 bits
             clock: 33MHz
             configuration: driver=i801_smbus latency=0
             resources: iomemory:2000-1fff irq:16 memory:20000000000-200000000ff ioport:780(size=32)
        *-serial:1 UNCLAIMED
             description: Serial bus controller
             product: C620 Series Chipset Family SPI Controller
             vendor: Intel Corporation
             physical id: 1f.5
             bus info: pci@0000:00:1f.5
             version: 09
             width: 32 bits
             clock: 33MHz
             configuration: latency=0
             resources: memory:fe010000-fe010fff
     *-pci:1
          description: PCI bridge
          product: Sky Lake-E PCI Express Root Port C
          vendor: Intel Corporation
          physical id: 101
          bus info: pci@0000:05:02.0
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pci msi pciexpress pm normal_decode bus_master cap_list
          configuration: driver=pcieport
          resources: irq:26 memory:d9b00000-d9efffff ioport:21ffa000000(size=87031808)
        *-pci
             description: PCI bridge
             product: Intel Corporation
             vendor: Intel Corporation
             physical id: 0
             bus info: pci@0000:06:00.0
             version: 09
             width: 64 bits
             clock: 33MHz
             capabilities: pci pciexpress pm normal_decode bus_master cap_list rom
             configuration: driver=pcieport
             resources: irq:27 memory:d9e00000-d9e1ffff memory:d9b00000-d9bfffff memory:d9c00000-d9dfffff ioport:21ffa000000(size=87031808)
           *-pci
                description: PCI bridge
                product: Intel Corporation
                vendor: Intel Corporation
                physical id: 3
                bus info: pci@0000:07:03.0
                version: 09
                width: 32 bits
                clock: 33MHz
                capabilities: pci pciexpress pm normal_decode bus_master cap_list
                configuration: driver=pcieport
                resources: irq:27 memory:d9c00000-d9dfffff ioport:21ffa000000(size=87031808)
              *-network:0
                   description: Ethernet interface
                   product: Ethernet Connection X722 for 1GbE
                   vendor: Intel Corporation
                   physical id: 0
                   bus info: pci@0000:08:00.0
                   logical name: eno1
                   version: 09
                   serial: 7c:d3:0a:ec:59:58
                   capacity: 1Gbit/s
                   width: 64 bits
                   clock: 33MHz
                   capabilities: pm msi msix pciexpress vpd bus_master cap_list rom ethernet physical 1000bt-fd autonegotiation
                   configuration: autonegotiation=off broadcast=yes driver=i40e driverversion=5.15.0-97-generic firmware=3.33 0x80000fdd 1.1824.0 latency=0 link=no multicast=yes
                   resources: iomemory:21f0-21ef iomemory:21f0-21ef irq:37 memory:21ffd000000-21ffdffffff memory:21fff018000-21fff01ffff memory:d9d80000-d9dfffff memory:21ffec00000-21ffeffffff memory:21fff1a0000-21fff21ffff
              *-network:1
                   description: Ethernet interface
                   product: Ethernet Connection X722 for 1GbE
                   vendor: Intel Corporation
                   physical id: 0.1
                   bus info: pci@0000:08:00.1
                   logical name: eno2
                   version: 09
                   serial: 7c:d3:0a:ec:59:59
                   capacity: 1Gbit/s
                   width: 64 bits
                   clock: 33MHz
                   capabilities: pm msi msix pciexpress vpd bus_master cap_list rom ethernet physical 1000bt-fd autonegotiation
                   configuration: autonegotiation=off broadcast=yes driver=i40e driverversion=5.15.0-97-generic firmware=3.33 0x80000fdd 1.1824.0 latency=0 link=no multicast=yes
                   resources: iomemory:21f0-21ef iomemory:21f0-21ef irq:37 memory:21ffc000000-21ffcffffff memory:21fff010000-21fff017fff memory:d9d00000-d9d7ffff memory:21ffe800000-21ffebfffff memory:21fff120000-21fff19ffff
              *-network:2
                   description: Ethernet interface
                   product: Ethernet Connection X722 for 1GbE
                   vendor: Intel Corporation
                   physical id: 0.2
                   bus info: pci@0000:08:00.2
                   logical name: eno3
                   version: 09
                   serial: 7c:d3:0a:ec:59:5a
                   size: 1Gbit/s
                   capacity: 1Gbit/s
                   width: 64 bits
                   clock: 33MHz
                   capabilities: pm msi msix pciexpress vpd bus_master cap_list rom ethernet physical tp 1000bt-fd autonegotiation
                   configuration: autonegotiation=on broadcast=yes driver=i40e driverversion=5.15.0-97-generic duplex=full firmware=3.33 0x80000fdd 1.1824.0 ip=192.168.1.180 latency=0 link=yes multicast=yes port=twisted pair speed=1Gbit/s
                   resources: iomemory:21f0-21ef iomemory:21f0-21ef irq:37 memory:21ffb000000-21ffbffffff memory:21fff008000-21fff00ffff memory:d9c80000-d9cfffff memory:21ffe400000-21ffe7fffff memory:21fff0a0000-21fff11ffff
              *-network:3
                   description: Ethernet interface
                   product: Ethernet Connection X722 for 1GbE
                   vendor: Intel Corporation
                   physical id: 0.3
                   bus info: pci@0000:08:00.3
                   logical name: eno4
                   version: 09
                   serial: 7c:d3:0a:ec:59:5b
                   size: 1Gbit/s
                   capacity: 1Gbit/s
                   width: 64 bits
                   clock: 33MHz
                   capabilities: pm msi msix pciexpress vpd bus_master cap_list rom ethernet physical tp 1000bt-fd autonegotiation
                   configuration: autonegotiation=on broadcast=yes driver=i40e driverversion=5.15.0-97-generic duplex=full firmware=3.33 0x80000fdd 1.1824.0 ip=192.168.1.30 latency=0 link=yes multicast=yes port=twisted pair speed=1Gbit/s
                   resources: iomemory:21f0-21ef iomemory:21f0-21ef irq:37 memory:21ffa000000-21ffaffffff memory:21fff000000-21fff007fff memory:d9c00000-d9c7ffff memory:21ffe000000-21ffe3fffff memory:21fff020000-21fff09ffff
     *-generic:0 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E VT-d
          vendor: Intel Corporation
          physical id: 6
          bus info: pci@0000:05:05.0
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: latency=0
     *-generic:1 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E RAS Configuration Registers
          vendor: Intel Corporation
          physical id: 7
          bus info: pci@0000:05:05.2
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: latency=0
     *-generic:2 UNCLAIMED
          description: PIC
          product: Sky Lake-E IOxAPIC Configuration Registers
          vendor: Intel Corporation
          physical id: 9
          bus info: pci@0000:05:05.4
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress pm io_x_-apic bus_master cap_list
          configuration: latency=0
          resources: memory:d9f00000-d9f00fff
     *-generic:3 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E CHA Registers
          vendor: Intel Corporation
          physical id: a
          bus info: pci@0000:05:08.0
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:4 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E CHA Registers
          vendor: Intel Corporation
          physical id: b
          bus info: pci@0000:05:08.1
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:5 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E CHA Registers
          vendor: Intel Corporation
          physical id: c
          bus info: pci@0000:05:08.2
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:6 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E CHA Registers
          vendor: Intel Corporation
          physical id: d
          bus info: pci@0000:05:08.3
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:7 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E CHA Registers
          vendor: Intel Corporation
          physical id: e
          bus info: pci@0000:05:08.4
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:8 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E CHA Registers
          vendor: Intel Corporation
          physical id: f
          bus info: pci@0000:05:08.5
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:9 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E CHA Registers
          vendor: Intel Corporation
          physical id: 10
          bus info: pci@0000:05:08.6
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:10 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E CHA Registers
          vendor: Intel Corporation
          physical id: 11
          bus info: pci@0000:05:08.7
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:11 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E CHA Registers
          vendor: Intel Corporation
          physical id: 12
          bus info: pci@0000:05:09.0
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:12 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E CHA Registers
          vendor: Intel Corporation
          physical id: 13
          bus info: pci@0000:05:09.1
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:13 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E CHA Registers
          vendor: Intel Corporation
          physical id: 14
          bus info: pci@0000:05:0e.0
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:14 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E CHA Registers
          vendor: Intel Corporation
          physical id: 15
          bus info: pci@0000:05:0e.1
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:15 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E CHA Registers
          vendor: Intel Corporation
          physical id: 16
          bus info: pci@0000:05:0e.2
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:16 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E CHA Registers
          vendor: Intel Corporation
          physical id: 17
          bus info: pci@0000:05:0e.3
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:17 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E CHA Registers
          vendor: Intel Corporation
          physical id: 18
          bus info: pci@0000:05:0e.4
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:18 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E CHA Registers
          vendor: Intel Corporation
          physical id: 19
          bus info: pci@0000:05:0e.5
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:19 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E CHA Registers
          vendor: Intel Corporation
          physical id: 1a
          bus info: pci@0000:05:0e.6
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:20 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E CHA Registers
          vendor: Intel Corporation
          physical id: 1b
          bus info: pci@0000:05:0e.7
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:21 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E CHA Registers
          vendor: Intel Corporation
          physical id: 1c
          bus info: pci@0000:05:0f.0
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:22 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E CHA Registers
          vendor: Intel Corporation
          physical id: 1d
          bus info: pci@0000:05:0f.1
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:23 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E CHA Registers
          vendor: Intel Corporation
          physical id: 1e
          bus info: pci@0000:05:1d.0
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:24 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E CHA Registers
          vendor: Intel Corporation
          physical id: 1f
          bus info: pci@0000:05:1d.1
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:25 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E CHA Registers
          vendor: Intel Corporation
          physical id: 21
          bus info: pci@0000:05:1d.2
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:26 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E CHA Registers
          vendor: Intel Corporation
          physical id: 22
          bus info: pci@0000:05:1d.3
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:27 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E PCU Registers
          vendor: Intel Corporation
          physical id: 23
          bus info: pci@0000:05:1e.0
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:28 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E PCU Registers
          vendor: Intel Corporation
          physical id: 24
          bus info: pci@0000:05:1e.1
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:29 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E PCU Registers
          vendor: Intel Corporation
          physical id: 25
          bus info: pci@0000:05:1e.2
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:30 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E PCU Registers
          vendor: Intel Corporation
          physical id: 26
          bus info: pci@0000:05:1e.3
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:31 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E PCU Registers
          vendor: Intel Corporation
          physical id: 27
          bus info: pci@0000:05:1e.4
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:32 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E PCU Registers
          vendor: Intel Corporation
          physical id: 28
          bus info: pci@0000:05:1e.5
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:33 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E PCU Registers
          vendor: Intel Corporation
          physical id: 29
          bus info: pci@0000:05:1e.6
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:34 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E VT-d
          vendor: Intel Corporation
          physical id: 2a
          bus info: pci@0000:2e:05.0
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: latency=0
     *-generic:35 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E RAS Configuration Registers
          vendor: Intel Corporation
          physical id: 2b
          bus info: pci@0000:2e:05.2
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: latency=0
     *-generic:36 UNCLAIMED
          description: PIC
          product: Sky Lake-E IOxAPIC Configuration Registers
          vendor: Intel Corporation
          physical id: 2c
          bus info: pci@0000:2e:05.4
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress pm io_x_-apic bus_master cap_list
          configuration: latency=0
          resources: memory:def00000-def00fff
     *-generic:37
          description: System peripheral
          product: Sky Lake-E Integrated Memory Controller
          vendor: Intel Corporation
          physical id: 2d
          bus info: pci@0000:2e:08.0
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: driver=skx_uncore latency=0
          resources: irq:0
     *-generic:38
          description: System peripheral
          product: Sky Lake-E Integrated Memory Controller
          vendor: Intel Corporation
          physical id: 2e
          bus info: pci@0000:2e:09.0
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: driver=skx_uncore latency=0
          resources: irq:0
     *-generic:39 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E Integrated Memory Controller
          vendor: Intel Corporation
          physical id: 2f
          bus info: pci@0000:2e:0a.0
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: latency=0
     *-generic:40 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E Integrated Memory Controller
          vendor: Intel Corporation
          physical id: 30
          bus info: pci@0000:2e:0a.1
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: latency=0
     *-generic:41
          description: System peripheral
          product: Sky Lake-E Integrated Memory Controller
          vendor: Intel Corporation
          physical id: 31
          bus info: pci@0000:2e:0a.2
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: driver=skx_uncore latency=0
          resources: irq:0
     *-generic:42 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E Integrated Memory Controller
          vendor: Intel Corporation
          physical id: 32
          bus info: pci@0000:2e:0a.3
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: latency=0
     *-generic:43 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E Integrated Memory Controller
          vendor: Intel Corporation
          physical id: 33
          bus info: pci@0000:2e:0a.4
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: latency=0
     *-generic:44 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E LM Channel 1
          vendor: Intel Corporation
          physical id: 34
          bus info: pci@0000:2e:0a.5
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: latency=0
     *-generic:45
          description: System peripheral
          product: Sky Lake-E LMS Channel 1
          vendor: Intel Corporation
          physical id: 35
          bus info: pci@0000:2e:0a.6
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: driver=skx_uncore latency=0
          resources: irq:0
     *-generic:46 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E LMDP Channel 1
          vendor: Intel Corporation
          physical id: 36
          bus info: pci@0000:2e:0a.7
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: latency=0
     *-generic:47 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E DECS Channel 2
          vendor: Intel Corporation
          physical id: 37
          bus info: pci@0000:2e:0b.0
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: latency=0
     *-generic:48 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E LM Channel 2
          vendor: Intel Corporation
          physical id: 38
          bus info: pci@0000:2e:0b.1
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: latency=0
     *-generic:49
          description: System peripheral
          product: Sky Lake-E LMS Channel 2
          vendor: Intel Corporation
          physical id: 39
          bus info: pci@0000:2e:0b.2
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: driver=skx_uncore latency=0
          resources: irq:0
     *-generic:50 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E LMDP Channel 2
          vendor: Intel Corporation
          physical id: 3a
          bus info: pci@0000:2e:0b.3
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: latency=0
     *-generic:51 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E Integrated Memory Controller
          vendor: Intel Corporation
          physical id: 3b
          bus info: pci@0000:2e:0c.0
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: latency=0
     *-generic:52 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E Integrated Memory Controller
          vendor: Intel Corporation
          physical id: 3c
          bus info: pci@0000:2e:0c.1
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: latency=0
     *-generic:53
          description: System peripheral
          product: Sky Lake-E Integrated Memory Controller
          vendor: Intel Corporation
          physical id: 3d
          bus info: pci@0000:2e:0c.2
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: driver=skx_uncore latency=0
          resources: irq:0
     *-generic:54 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E Integrated Memory Controller
          vendor: Intel Corporation
          physical id: 3e
          bus info: pci@0000:2e:0c.3
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: latency=0
     *-generic:55 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E Integrated Memory Controller
          vendor: Intel Corporation
          physical id: 3f
          bus info: pci@0000:2e:0c.4
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: latency=0
     *-generic:56 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E LM Channel 1
          vendor: Intel Corporation
          physical id: 41
          bus info: pci@0000:2e:0c.5
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: latency=0
     *-generic:57
          description: System peripheral
          product: Sky Lake-E LMS Channel 1
          vendor: Intel Corporation
          physical id: 42
          bus info: pci@0000:2e:0c.6
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: driver=skx_uncore latency=0
          resources: irq:0
     *-generic:58 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E LMDP Channel 1
          vendor: Intel Corporation
          physical id: 43
          bus info: pci@0000:2e:0c.7
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: latency=0
     *-generic:59 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E DECS Channel 2
          vendor: Intel Corporation
          physical id: 45
          bus info: pci@0000:2e:0d.0
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: latency=0
     *-generic:60 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E LM Channel 2
          vendor: Intel Corporation
          physical id: 46
          bus info: pci@0000:2e:0d.1
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: latency=0
     *-generic:61
          description: System peripheral
          product: Sky Lake-E LMS Channel 2
          vendor: Intel Corporation
          physical id: 47
          bus info: pci@0000:2e:0d.2
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: driver=skx_uncore latency=0
          resources: irq:0
     *-generic:62 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E LMDP Channel 2
          vendor: Intel Corporation
          physical id: 48
          bus info: pci@0000:2e:0d.3
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: latency=0
     *-pci:2
          description: PCI bridge
          product: Sky Lake-E PCI Express Root Port C
          vendor: Intel Corporation
          physical id: 102
          bus info: pci@0000:57:02.0
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pci msi pciexpress pm normal_decode bus_master cap_list
          configuration: driver=pcieport
          resources: irq:29 ioport:8000(size=4096) memory:e3d00000-e3efffff ioport:23fffe00000(size=2097152)
        *-raid
             description: RAID bus controller
             product: MegaRAID Tri-Mode SAS3516
             vendor: Broadcom / LSI
             physical id: 0
             bus info: pci@0000:58:00.0
             logical name: scsi0
             version: 01
             width: 64 bits
             clock: 33MHz
             capabilities: raid pm msi pciexpress msix vpd bus_master cap_list rom
             configuration: driver=megaraid_sas latency=0
             resources: iomemory:23f0-23ef iomemory:23f0-23ef irq:38 memory:23ffff00000-23fffffffff memory:23fffe00000-23fffefffff memory:e3e00000-e3efffff ioport:8000(size=256) memory:e3d00000-e3dfffff
           *-disk:0
                description: SCSI Disk
                product: RAID 930-16i-4GB
                vendor: Lenovo
                physical id: 2.0.0
                bus info: scsi@0:2.0.0
                logical name: /dev/sda
                version: 5.05
                serial: 005d40e5a3e224a12340d6ed02b26200
                size: 52GiB (56GB)
                capabilities: partitioned partitioned:dos
                configuration: ansiversion=5 logicalsectorsize=512 sectorsize=4096 signature=b4935c3c
              *-volume
                   description: Linux filesystem partition
                   physical id: 1
                   bus info: scsi@0:2.0.0,1
                   logical name: /dev/sda1
                   serial: lq80ZR-7eSz-FsyC-9eXh-Yk7d-aROi-qopi57
                   size: 52GiB
                   capacity: 52GiB
                   capabilities: primary lvm2
           *-disk:1
                description: SCSI Disk
                product: RAID 930-16i-4GB
                vendor: Lenovo
                physical id: 2.1.0
                bus info: scsi@0:2.1.0
                logical name: /dev/sdb
                version: 5.05
                serial: 00fdbb87022225a12340d6ed02b26200
                size: 1285GiB (1380GB)
                capabilities: gpt-1.00 partitioned partitioned:gpt
                configuration: ansiversion=5 guid=5b539fcb-6203-4627-93ff-dd732195fb14 logicalsectorsize=512 sectorsize=4096
              *-volume:0
                   description: Windows FAT volume
                   vendor: mkfs.fat
                   physical id: 1
                   bus info: scsi@0:2.1.0,1
                   logical name: /dev/sdb1
                   logical name: /boot/efi
                   version: FAT32
                   serial: c276-e129
                   size: 1073MiB
                   capacity: 1074MiB
                   capabilities: boot fat initialized
                   configuration: FATs=2 filesystem=fat mount.fstype=vfat mount.options=rw,relatime,fmask=0022,dmask=0022,codepage=437,iocharset=iso8859-1,shortname=mixed,errors=remount-ro state=mounted
              *-volume:1
                   description: EXT4 volume
                   vendor: Linux
                   physical id: 2
                   bus info: scsi@0:2.1.0,2
                   logical name: /dev/sdb2
                   logical name: /boot
                   version: 1.0
                   serial: ddb62c44-0f09-4b47-bcd9-e43ab3e89136
                   size: 2GiB
                   capabilities: journaled extended_attributes large_files huge_files dir_nlink recover 64bit extents ext4 ext2 initialized
                   configuration: created=2023-12-05 13:30:01 filesystem=ext4 lastmountpoint=/boot modified=2026-03-05 10:55:26 mount.fstype=ext4 mount.options=rw,relatime,stripe=48 mounted=2026-03-05 10:55:26 state=mounted
              *-volume:2
                   description: EFI partition
                   physical id: 3
                   bus info: scsi@0:2.1.0,3
                   logical name: /dev/sdb3
                   serial: xIzwN1-lmc7-1gxE-9QbM-4yNx-J1CO-2v60kw
                   size: 1282GiB
                   capabilities: lvm2
     *-generic:63 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E VT-d
          vendor: Intel Corporation
          physical id: 49
          bus info: pci@0000:57:05.0
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: latency=0
     *-generic:64 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E RAS Configuration Registers
          vendor: Intel Corporation
          physical id: 4a
          bus info: pci@0000:57:05.2
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: latency=0
     *-generic:65 UNCLAIMED
          description: PIC
          product: Sky Lake-E IOxAPIC Configuration Registers
          vendor: Intel Corporation
          physical id: 4b
          bus info: pci@0000:57:05.4
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress pm io_x_-apic bus_master cap_list
          configuration: latency=0
          resources: memory:e3f00000-e3f00fff
     *-generic:66
          description: Performance counters
          product: Sky Lake-E KTI 0
          vendor: Intel Corporation
          physical id: 4c
          bus info: pci@0000:57:0e.0
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: driver=skx_uncore latency=0
          resources: irq:0
     *-generic:67 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E UPI Registers
          vendor: Intel Corporation
          physical id: 4d
          bus info: pci@0000:57:0e.1
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: latency=0
     *-generic:68
          description: Performance counters
          product: Sky Lake-E KTI 0
          vendor: Intel Corporation
          physical id: 4e
          bus info: pci@0000:57:0f.0
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: driver=skx_uncore latency=0
          resources: irq:0
     *-generic:69 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E UPI Registers
          vendor: Intel Corporation
          physical id: 4f
          bus info: pci@0000:57:0f.1
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: latency=0
     *-generic:70 UNCLAIMED
          description: Performance counters
          product: Sky Lake-E M3KTI Registers
          vendor: Intel Corporation
          physical id: 50
          bus info: pci@0000:57:12.0
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: latency=0
     *-generic:71
          description: Performance counters
          product: Sky Lake-E M3KTI Registers
          vendor: Intel Corporation
          physical id: 51
          bus info: pci@0000:57:12.1
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: driver=skx_uncore latency=0
          resources: irq:0
     *-generic:72
          description: System peripheral
          product: Sky Lake-E M3KTI Registers
          vendor: Intel Corporation
          physical id: 52
          bus info: pci@0000:57:12.2
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: driver=skx_uncore latency=0
          resources: irq:0
     *-generic:73 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E M2PCI Registers
          vendor: Intel Corporation
          physical id: 53
          bus info: pci@0000:57:15.0
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:74 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E M2PCI Registers
          vendor: Intel Corporation
          physical id: 54
          bus info: pci@0000:57:16.0
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:75 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E M2PCI Registers
          vendor: Intel Corporation
          physical id: 55
          bus info: pci@0000:57:16.4
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:76
          description: System peripheral
          product: Sky Lake-E CBDMA Registers
          vendor: Intel Corporation
          physical id: 4
          bus info: pci@0000:80:04.0
          version: 04
          width: 64 bits
          clock: 33MHz
          capabilities: msix pciexpress pm bus_master cap_list
          configuration: driver=ioatdma latency=0
          resources: iomemory:24f0-24ef irq:534 memory:24ffff1c000-24ffff1ffff
     *-generic:77
          description: System peripheral
          product: Sky Lake-E CBDMA Registers
          vendor: Intel Corporation
          physical id: 4.1
          bus info: pci@0000:80:04.1
          version: 04
          width: 64 bits
          clock: 33MHz
          capabilities: msix pciexpress pm bus_master cap_list
          configuration: driver=ioatdma latency=0
          resources: iomemory:24f0-24ef irq:536 memory:24ffff18000-24ffff1bfff
     *-generic:78
          description: System peripheral
          product: Sky Lake-E CBDMA Registers
          vendor: Intel Corporation
          physical id: 4.2
          bus info: pci@0000:80:04.2
          version: 04
          width: 64 bits
          clock: 33MHz
          capabilities: msix pciexpress pm bus_master cap_list
          configuration: driver=ioatdma latency=0
          resources: iomemory:24f0-24ef irq:534 memory:24ffff14000-24ffff17fff
     *-generic:79
          description: System peripheral
          product: Sky Lake-E CBDMA Registers
          vendor: Intel Corporation
          physical id: 4.3
          bus info: pci@0000:80:04.3
          version: 04
          width: 64 bits
          clock: 33MHz
          capabilities: msix pciexpress pm bus_master cap_list
          configuration: driver=ioatdma latency=0
          resources: iomemory:24f0-24ef irq:536 memory:24ffff10000-24ffff13fff
     *-generic:80
          description: System peripheral
          product: Sky Lake-E CBDMA Registers
          vendor: Intel Corporation
          physical id: 4.4
          bus info: pci@0000:80:04.4
          version: 04
          width: 64 bits
          clock: 33MHz
          capabilities: msix pciexpress pm bus_master cap_list
          configuration: driver=ioatdma latency=0
          resources: iomemory:24f0-24ef irq:534 memory:24ffff0c000-24ffff0ffff
     *-generic:81
          description: System peripheral
          product: Sky Lake-E CBDMA Registers
          vendor: Intel Corporation
          physical id: 4.5
          bus info: pci@0000:80:04.5
          version: 04
          width: 64 bits
          clock: 33MHz
          capabilities: msix pciexpress pm bus_master cap_list
          configuration: driver=ioatdma latency=0
          resources: iomemory:24f0-24ef irq:536 memory:24ffff08000-24ffff0bfff
     *-generic:82
          description: System peripheral
          product: Sky Lake-E CBDMA Registers
          vendor: Intel Corporation
          physical id: 4.6
          bus info: pci@0000:80:04.6
          version: 04
          width: 64 bits
          clock: 33MHz
          capabilities: msix pciexpress pm bus_master cap_list
          configuration: driver=ioatdma latency=0
          resources: iomemory:24f0-24ef irq:534 memory:24ffff04000-24ffff07fff
     *-generic:83
          description: System peripheral
          product: Sky Lake-E CBDMA Registers
          vendor: Intel Corporation
          physical id: 4.7
          bus info: pci@0000:80:04.7
          version: 04
          width: 64 bits
          clock: 33MHz
          capabilities: msix pciexpress pm bus_master cap_list
          configuration: driver=ioatdma latency=0
          resources: iomemory:24f0-24ef irq:536 memory:24ffff00000-24ffff03fff
     *-generic:84 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E MM/Vt-d Configuration Registers
          vendor: Intel Corporation
          physical id: 56
          bus info: pci@0000:80:05.0
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: latency=0
     *-generic:85 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E RAS
          vendor: Intel Corporation
          physical id: 57
          bus info: pci@0000:80:05.2
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: latency=0
     *-generic:86 UNCLAIMED
          description: PIC
          product: Sky Lake-E IOAPIC
          vendor: Intel Corporation
          physical id: 58
          bus info: pci@0000:80:05.4
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress pm io_x_-apic bus_master cap_list
          configuration: latency=0
          resources: memory:e8f00000-e8f00fff
     *-generic:87 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E Ubox Registers
          vendor: Intel Corporation
          physical id: 59
          bus info: pci@0000:80:08.0
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: latency=0
     *-generic:88 UNCLAIMED
          description: Performance counters
          product: Sky Lake-E Ubox Registers
          vendor: Intel Corporation
          physical id: 5a
          bus info: pci@0000:80:08.1
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:89 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E Ubox Registers
          vendor: Intel Corporation
          physical id: 5b
          bus info: pci@0000:80:08.2
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: latency=0
     *-generic:90 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E VT-d
          vendor: Intel Corporation
          physical id: 5c
          bus info: pci@0000:85:05.0
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: latency=0
     *-generic:91 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E RAS Configuration Registers
          vendor: Intel Corporation
          physical id: 5d
          bus info: pci@0000:85:05.2
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: latency=0
     *-generic:92 UNCLAIMED
          description: PIC
          product: Sky Lake-E IOxAPIC Configuration Registers
          vendor: Intel Corporation
          physical id: 5e
          bus info: pci@0000:85:05.4
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress pm io_x_-apic bus_master cap_list
          configuration: latency=0
          resources: memory:edf00000-edf00fff
     *-generic:93 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E CHA Registers
          vendor: Intel Corporation
          physical id: 5f
          bus info: pci@0000:85:08.0
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:94 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E CHA Registers
          vendor: Intel Corporation
          physical id: 8.1
          bus info: pci@0000:85:08.1
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:95 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E CHA Registers
          vendor: Intel Corporation
          physical id: 8.2
          bus info: pci@0000:85:08.2
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:96 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E CHA Registers
          vendor: Intel Corporation
          physical id: 60
          bus info: pci@0000:85:08.3
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:97 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E CHA Registers
          vendor: Intel Corporation
          physical id: 61
          bus info: pci@0000:85:08.4
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:98 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E CHA Registers
          vendor: Intel Corporation
          physical id: 62
          bus info: pci@0000:85:08.5
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:99 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E CHA Registers
          vendor: Intel Corporation
          physical id: 63
          bus info: pci@0000:85:08.6
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:100 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E CHA Registers
          vendor: Intel Corporation
          physical id: 64
          bus info: pci@0000:85:08.7
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:101 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E CHA Registers
          vendor: Intel Corporation
          physical id: 65
          bus info: pci@0000:85:09.0
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:102 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E CHA Registers
          vendor: Intel Corporation
          physical id: 66
          bus info: pci@0000:85:09.1
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:103 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E CHA Registers
          vendor: Intel Corporation
          physical id: 67
          bus info: pci@0000:85:0e.0
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:104 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E CHA Registers
          vendor: Intel Corporation
          physical id: 68
          bus info: pci@0000:85:0e.1
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:105 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E CHA Registers
          vendor: Intel Corporation
          physical id: 69
          bus info: pci@0000:85:0e.2
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:106 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E CHA Registers
          vendor: Intel Corporation
          physical id: 6a
          bus info: pci@0000:85:0e.3
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:107 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E CHA Registers
          vendor: Intel Corporation
          physical id: 6b
          bus info: pci@0000:85:0e.4
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:108 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E CHA Registers
          vendor: Intel Corporation
          physical id: 6c
          bus info: pci@0000:85:0e.5
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:109 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E CHA Registers
          vendor: Intel Corporation
          physical id: 6d
          bus info: pci@0000:85:0e.6
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:110 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E CHA Registers
          vendor: Intel Corporation
          physical id: 6e
          bus info: pci@0000:85:0e.7
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:111 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E CHA Registers
          vendor: Intel Corporation
          physical id: 6f
          bus info: pci@0000:85:0f.0
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:112 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E CHA Registers
          vendor: Intel Corporation
          physical id: 70
          bus info: pci@0000:85:0f.1
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:113 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E CHA Registers
          vendor: Intel Corporation
          physical id: 71
          bus info: pci@0000:85:1d.0
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:114 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E CHA Registers
          vendor: Intel Corporation
          physical id: 72
          bus info: pci@0000:85:1d.1
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:115 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E CHA Registers
          vendor: Intel Corporation
          physical id: 73
          bus info: pci@0000:85:1d.2
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:116 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E CHA Registers
          vendor: Intel Corporation
          physical id: 74
          bus info: pci@0000:85:1d.3
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:117 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E PCU Registers
          vendor: Intel Corporation
          physical id: 75
          bus info: pci@0000:85:1e.0
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:118 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E PCU Registers
          vendor: Intel Corporation
          physical id: 76
          bus info: pci@0000:85:1e.1
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:119 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E PCU Registers
          vendor: Intel Corporation
          physical id: 77
          bus info: pci@0000:85:1e.2
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:120 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E PCU Registers
          vendor: Intel Corporation
          physical id: 78
          bus info: pci@0000:85:1e.3
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:121 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E PCU Registers
          vendor: Intel Corporation
          physical id: 79
          bus info: pci@0000:85:1e.4
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:122 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E PCU Registers
          vendor: Intel Corporation
          physical id: 7a
          bus info: pci@0000:85:1e.5
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:123 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E PCU Registers
          vendor: Intel Corporation
          physical id: 7b
          bus info: pci@0000:85:1e.6
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:124 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E VT-d
          vendor: Intel Corporation
          physical id: 7c
          bus info: pci@0000:ae:05.0
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: latency=0
     *-generic:125 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E RAS Configuration Registers
          vendor: Intel Corporation
          physical id: 7d
          bus info: pci@0000:ae:05.2
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: latency=0
     *-generic:126 UNCLAIMED
          description: PIC
          product: Sky Lake-E IOxAPIC Configuration Registers
          vendor: Intel Corporation
          physical id: 7e
          bus info: pci@0000:ae:05.4
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress pm io_x_-apic bus_master cap_list
          configuration: latency=0
          resources: memory:f2f00000-f2f00fff
     *-generic:127
          description: System peripheral
          product: Sky Lake-E Integrated Memory Controller
          vendor: Intel Corporation
          physical id: 8
          bus info: pci@0000:ae:08.0
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: driver=skx_uncore latency=0
          resources: irq:0
     *-generic:128
          description: System peripheral
          product: Sky Lake-E Integrated Memory Controller
          vendor: Intel Corporation
          physical id: 7f
          bus info: pci@0000:ae:09.0
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: driver=skx_uncore latency=0
          resources: irq:0
     *-generic:129 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E Integrated Memory Controller
          vendor: Intel Corporation
          physical id: 80
          bus info: pci@0000:ae:0a.0
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: latency=0
     *-generic:130 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E Integrated Memory Controller
          vendor: Intel Corporation
          physical id: 81
          bus info: pci@0000:ae:0a.1
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: latency=0
     *-generic:131
          description: System peripheral
          product: Sky Lake-E Integrated Memory Controller
          vendor: Intel Corporation
          physical id: 82
          bus info: pci@0000:ae:0a.2
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: driver=skx_uncore latency=0
          resources: irq:0
     *-generic:132 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E Integrated Memory Controller
          vendor: Intel Corporation
          physical id: 83
          bus info: pci@0000:ae:0a.3
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: latency=0
     *-generic:133 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E Integrated Memory Controller
          vendor: Intel Corporation
          physical id: 84
          bus info: pci@0000:ae:0a.4
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: latency=0
     *-generic:134 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E LM Channel 1
          vendor: Intel Corporation
          physical id: 85
          bus info: pci@0000:ae:0a.5
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: latency=0
     *-generic:135
          description: System peripheral
          product: Sky Lake-E LMS Channel 1
          vendor: Intel Corporation
          physical id: 86
          bus info: pci@0000:ae:0a.6
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: driver=skx_uncore latency=0
          resources: irq:0
     *-generic:136 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E LMDP Channel 1
          vendor: Intel Corporation
          physical id: 87
          bus info: pci@0000:ae:0a.7
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: latency=0
     *-generic:137 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E DECS Channel 2
          vendor: Intel Corporation
          physical id: 88
          bus info: pci@0000:ae:0b.0
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: latency=0
     *-generic:138 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E LM Channel 2
          vendor: Intel Corporation
          physical id: 89
          bus info: pci@0000:ae:0b.1
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: latency=0
     *-generic:139
          description: System peripheral
          product: Sky Lake-E LMS Channel 2
          vendor: Intel Corporation
          physical id: 8a
          bus info: pci@0000:ae:0b.2
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: driver=skx_uncore latency=0
          resources: irq:0
     *-generic:140 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E LMDP Channel 2
          vendor: Intel Corporation
          physical id: 8b
          bus info: pci@0000:ae:0b.3
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: latency=0
     *-generic:141 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E Integrated Memory Controller
          vendor: Intel Corporation
          physical id: 8c
          bus info: pci@0000:ae:0c.0
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: latency=0
     *-generic:142 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E Integrated Memory Controller
          vendor: Intel Corporation
          physical id: 8d
          bus info: pci@0000:ae:0c.1
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: latency=0
     *-generic:143
          description: System peripheral
          product: Sky Lake-E Integrated Memory Controller
          vendor: Intel Corporation
          physical id: 8e
          bus info: pci@0000:ae:0c.2
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: driver=skx_uncore latency=0
          resources: irq:0
     *-generic:144 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E Integrated Memory Controller
          vendor: Intel Corporation
          physical id: 8f
          bus info: pci@0000:ae:0c.3
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: latency=0
     *-generic:145 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E Integrated Memory Controller
          vendor: Intel Corporation
          physical id: 90
          bus info: pci@0000:ae:0c.4
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: latency=0
     *-generic:146 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E LM Channel 1
          vendor: Intel Corporation
          physical id: 91
          bus info: pci@0000:ae:0c.5
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: latency=0
     *-generic:147
          description: System peripheral
          product: Sky Lake-E LMS Channel 1
          vendor: Intel Corporation
          physical id: 92
          bus info: pci@0000:ae:0c.6
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: driver=skx_uncore latency=0
          resources: irq:0
     *-generic:148 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E LMDP Channel 1
          vendor: Intel Corporation
          physical id: 93
          bus info: pci@0000:ae:0c.7
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: latency=0
     *-generic:149 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E DECS Channel 2
          vendor: Intel Corporation
          physical id: 94
          bus info: pci@0000:ae:0d.0
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: latency=0
     *-generic:150 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E LM Channel 2
          vendor: Intel Corporation
          physical id: 95
          bus info: pci@0000:ae:0d.1
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: latency=0
     *-generic:151
          description: System peripheral
          product: Sky Lake-E LMS Channel 2
          vendor: Intel Corporation
          physical id: 96
          bus info: pci@0000:ae:0d.2
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: driver=skx_uncore latency=0
          resources: irq:0
     *-generic:152 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E LMDP Channel 2
          vendor: Intel Corporation
          physical id: 97
          bus info: pci@0000:ae:0d.3
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: latency=0
     *-pci:3
          description: PCI bridge
          product: Sky Lake-E PCI Express Root Port A
          vendor: Intel Corporation
          physical id: 103
          bus info: pci@0000:d7:00.0
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pci msi pciexpress pm normal_decode bus_master cap_list
          configuration: driver=pcieport
          resources: irq:31 memory:f7e00000-f7efffff ioport:27ffff00000(size=1048576)
     *-pci:4
          description: PCI bridge
          product: Sky Lake-E PCI Express Root Port B
          vendor: Intel Corporation
          physical id: 1
          bus info: pci@0000:d7:01.0
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pci msi pciexpress pm normal_decode bus_master cap_list
          configuration: driver=pcieport
          resources: irq:32 memory:f7d00000-f7dfffff ioport:27fffe00000(size=1048576)
     *-pci:5
          description: PCI bridge
          product: Sky Lake-E PCI Express Root Port C
          vendor: Intel Corporation
          physical id: 2
          bus info: pci@0000:d7:02.0
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pci msi pciexpress pm normal_decode bus_master cap_list
          configuration: driver=pcieport
          resources: irq:33 memory:f7c00000-f7cfffff ioport:27fffd00000(size=1048576)
     *-pci:6
          description: PCI bridge
          product: Sky Lake-E PCI Express Root Port D
          vendor: Intel Corporation
          physical id: 3
          bus info: pci@0000:d7:03.0
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pci msi pciexpress pm normal_decode bus_master cap_list
          configuration: driver=pcieport
          resources: irq:34 ioport:f000(size=4096) memory:f7b00000-f7bfffff ioport:27fffc00000(size=1048576)
     *-generic:153 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E VT-d
          vendor: Intel Corporation
          physical id: 5
          bus info: pci@0000:d7:05.0
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: latency=0
     *-generic:154 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E RAS Configuration Registers
          vendor: Intel Corporation
          physical id: 5.2
          bus info: pci@0000:d7:05.2
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: latency=0
     *-generic:155 UNCLAIMED
          description: PIC
          product: Sky Lake-E IOxAPIC Configuration Registers
          vendor: Intel Corporation
          physical id: 5.4
          bus info: pci@0000:d7:05.4
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress pm io_x_-apic bus_master cap_list
          configuration: latency=0
          resources: memory:f7f00000-f7f00fff
     *-generic:156
          description: Performance counters
          product: Sky Lake-E KTI 0
          vendor: Intel Corporation
          physical id: 98
          bus info: pci@0000:d7:0e.0
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: driver=skx_uncore latency=0
          resources: irq:0
     *-generic:157 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E UPI Registers
          vendor: Intel Corporation
          physical id: 99
          bus info: pci@0000:d7:0e.1
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: latency=0
     *-generic:158
          description: Performance counters
          product: Sky Lake-E KTI 0
          vendor: Intel Corporation
          physical id: 9a
          bus info: pci@0000:d7:0f.0
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: driver=skx_uncore latency=0
          resources: irq:0
     *-generic:159 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E UPI Registers
          vendor: Intel Corporation
          physical id: 9b
          bus info: pci@0000:d7:0f.1
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: latency=0
     *-generic:160 UNCLAIMED
          description: Performance counters
          product: Sky Lake-E M3KTI Registers
          vendor: Intel Corporation
          physical id: 9c
          bus info: pci@0000:d7:12.0
          version: 04
          width: 32 bits
          clock: 33MHz
          capabilities: pciexpress cap_list
          configuration: latency=0
     *-generic:161
          description: Performance counters
          product: Sky Lake-E M3KTI Registers
          vendor: Intel Corporation
          physical id: 9d
          bus info: pci@0000:d7:12.1
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: driver=skx_uncore latency=0
          resources: irq:0
     *-generic:162
          description: System peripheral
          product: Sky Lake-E M3KTI Registers
          vendor: Intel Corporation
          physical id: 9e
          bus info: pci@0000:d7:12.2
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: driver=skx_uncore latency=0
          resources: irq:0
     *-generic:163 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E M2PCI Registers
          vendor: Intel Corporation
          physical id: 9f
          bus info: pci@0000:d7:15.0
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:164 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E M2PCI Registers
          vendor: Intel Corporation
          physical id: a0
          bus info: pci@0000:d7:16.0
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
     *-generic:165 UNCLAIMED
          description: System peripheral
          product: Sky Lake-E M2PCI Registers
          vendor: Intel Corporation
          physical id: a1
          bus info: pci@0000:d7:16.4
          version: 04
          width: 32 bits
          clock: 33MHz
          configuration: latency=0
  *-input
       product: Power Button
       physical id: 1
       logical name: input0
       logical name: /dev/input/event0
       capabilities: platform
