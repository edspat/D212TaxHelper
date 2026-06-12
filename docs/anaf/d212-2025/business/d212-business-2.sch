<pattern xmlns="http://purl.oclc.org/dsdl/schematron" id="business-2">
    <!-- versiunea v1.0.0 din 23.12.2025 conform cu d212_documentatieTehnica_v1.0.0_23122025.xls --> 
    <!-- Conține reguli: 
        BR-D212-0017 … BR-D212-0029, BR-D212-0030 … BR-D212-0040, 
    -->
    
    <title>D212 – Business validation</title>
  
    <!-- Regula: cass_optiune = round(baza_optiune * 10% ) = 2430 -->
    <rule context="//*[@cass_optiune]">
        
        <!-- descrieri din XSD -->
        <let name="desc_cass"
            value="$schema//xs:attribute[@name='cass_optiune']
            /xs:annotation/xs:documentation[1]"/>
        
        <let name="desc_baza"
            value="$schema//xs:attribute[@name='baza_optiune']
            /xs:annotation/xs:documentation[1]"/>
        
        <!-- valori normalizate -->
        <let name="cass" value="normalize-space(@cass_optiune)"/>
        <let name="baza" value="normalize-space(@baza_optiune)"/>
        
        <!-- flags -->
        <let name="hasCass" value="string-length($cass) > 0"/>
        <let name="hasBaza" value="string-length($baza) > 0"/>
        
        <!-- conversii -->
        <let name="nCass" value="number($cass)"/>
        <let name="nBaza" value="number($baza)"/>
        
        <!-- calcul teoretic: round(baza * 10%) -->
        <let name="expected"
            value="round($nBaza * 0.10)"/>
        
        <!-- Regula:
         - dacă cass_optiune este completat → trebuie să fie egal cu round(baza_optiune × 10%)
         - dacă nu este completat → nu verificăm
    -->
        <let name="isValid"
            value="not($hasCass)
            or
            ($hasBaza and $nCass = $expected)"/>
        
        <assert test="$isValid"
            flag="fatal"
            id="BR-D212-0017">
            [BR-D212-0017]
            <value-of select="
                if (normalize-space($desc_cass) != '')
                then $desc_cass
                else 'cass_optiune'
                "/>
            (cass_optiune)
            din elementul <value-of select="name(.)"/>
            trebuie sa fie egal cu 10% din
            <value-of select="
                if (normalize-space($desc_baza) != '')
                then $desc_baza
                else 'baza_optiune'
                "/>
            (baza_optiune),
            rotunjit matematic la numar intreg.
            Valoare asteptata: <value-of select="$expected"/>.
        </assert>
        
    </rule>
    
    <!-- Regula BR-D212-0018: bifa_optiune_coasigurat = 1 <=> exista cel putin un <coasigurat> in formular -->
    <rule context="//@*[name(.) = 'bifa_optiune_coasigurat']">
        
        <!-- numele atributului curent -->
        <let name="attName" value="name(.)"/>
        
        <!-- descriere atribut bifa_optiune_coasigurat din XSD -->
        <let name="desc_bifa"
            value="$schema//xs:attribute[@name = $attName]
            /xs:annotation/xs:documentation[1]"/>
        
        <!-- descriere element coasigurat din XSD -->
        <let name="desc_coasig"
            value="$schema//xs:element[@name = 'coasigurat']
            /xs:annotation/xs:documentation[1]"/>
        
        <!-- valoarea bifei -->
        <let name="bifa" value="normalize-space(.)"/>
        
        <!-- exista cel putin un <coasigurat> oriunde in formular (sub radacina d212) -->
        <let name="hasCoasig"
            value="exists(/*/*[local-name() = 'coasigurat'])"/>
        <!-- alternativ, daca preferi cu namespace:
             value="exists(//d212:coasigurat)" -->
        
        <!-- echivalenta: bifa_optiune_coasigurat = 1  <=>  exista <coasigurat> -->
        <let name="isValid"
            value="( $bifa = '1' and $hasCoasig )
            or ( $bifa != '1' and not($hasCoasig) )"/>
        
        <assert test="$isValid"
            flag="fatal"
            id="BR-D212-0018">
            [BR-D212-0018]
            Atributul 
            <value-of select="
                if (normalize-space($desc_bifa) != '')
                then $desc_bifa
                else $attName
                "/>
            (<value-of select="$attName"/>)
            si elementul 
            <value-of select="
                if (normalize-space($desc_coasig) != '')
                then $desc_coasig
                else 'coasigurat'
                "/>
            (coasigurat)
            din elementul <value-of select="name(/*)"/>
            trebuie sa fie corelate astfel:
            daca 
            <value-of select="
                if (normalize-space($desc_bifa) != '')
                then $desc_bifa
                else $attName
                "/>
            (<value-of select="$attName"/>)
            are valoarea 1, atunci 
            <value-of select="
                if (normalize-space($desc_coasig) != '')
                then $desc_coasig
                else 'coasigurat'
                "/>
            (coasigurat)
            trebuie sa existe,
            iar daca 
            <value-of select="
                if (normalize-space($desc_coasig) != '')
                then $desc_coasig
                else 'coasigurat'
                "/>
            (coasigurat)
            exista, atunci 
            <value-of select="
                if (normalize-space($desc_bifa) != '')
                then $desc_bifa
                else $attName
                "/>
            (<value-of select="$attName"/>)
            trebuie sa aiba valoarea 1.
        </assert>
        
    </rule>
    <!-- Regula: totalCassDatoratCoasigurat = SUM(cassDatoratCoasigurat) -->
    <rule context="//@*[name(.) = 'totalCassDatoratCoasigurat']">
        
        <!-- numele atributului curent -->
        <let name="attName" value="name(.)"/>
        
        <!-- descrierea din XSD pentru totalCassDatoratCoasigurat -->
        <let name="desc"
            value="$schema//xs:attribute[@name = $attName]
            /xs:annotation/xs:documentation[1]"/>
        
        <!-- valoarea numerică a lui totalCassDatoratCoasigurat -->
        <let name="totalCass"
            value="number(normalize-space(.))"/>
        
        <!-- elementul radacina d212 (indiferent de prefix) -->
        <let name="root"
            value="ancestor::*[local-name() = 'd212'][1]"/>
        
        <!-- suma tuturor atributelor cassDatoratCoasigurat din toate elementele <coasigurat> -->
        <let name="sumCass"
            value="
            sum(
            for $c in $root/*[local-name() = 'coasigurat']/@cassDatoratCoasigurat
            return number(normalize-space($c))
            )
            "/>
        
        <!-- validare: totalCassDatoratCoasigurat = suma cassDatoratCoasigurat -->
        <let name="isValid"
            value="$totalCass = $sumCass"/>
        
        <assert
            test="$isValid"
            flag="fatal"
            id="BR-D212-0019">
            [BR-D212-0019]
            <value-of select="
                if (normalize-space($desc) != '')
                then $desc
                else $attName
                "/>
            (<value-of select="$attName"/>)
            din elementul <value-of select="name(..)"/>
            trebuie sa fie egal cu suma atributelor cassDatoratCoasigurat
            din toate elementele coasigurat din formular.
        </assert>
        
    </rule>
    
    <!-- Regula: totalCassDatorat = cass_optiune + totalCassDatoratCoasigurat
     Cerinta: daca un atribut din formula lipseste, se considera 0 (nu declanseaza eroare) -->
    <rule context="//@*[name(.) = 'totalCassDatorat']">
        
        <!-- numele atributului curent -->
        <let name="attName" value="name(.)"/>
        
        <!-- descrierea din XSD pentru totalCassDatorat -->
        <let name="desc"
            value="$schema//xs:attribute[@name = $attName]/xs:annotation/xs:documentation[1]"/>
        
        <!-- valoarea numerică totalCassDatorat (fallback 0 daca lipseste/vid) -->
        <let name="total"
            value="if (normalize-space(string(.)) != '') then number(normalize-space(.)) else 0"/>
        
        <!-- elementul oblig_estimat care contine atributele necesare -->
        <let name="obl"
            value="parent::*[local-name() = 'oblig_estimat']"/>
        
        <!-- cass_optiune (fallback 0 daca atributul lipseste/vid) -->
        <let name="cassOpt"
            value="if (exists($obl/@cass_optiune) and normalize-space(string($obl/@cass_optiune)) != '')
            then number(normalize-space(string($obl/@cass_optiune)))
            else 0"/>
        
        <!-- totalCassDatoratCoasigurat (fallback 0 daca atributul lipseste/vid) -->
        <let name="cassCoasig"
            value="if (exists($obl/@totalCassDatoratCoasigurat) and normalize-space(string($obl/@totalCassDatoratCoasigurat)) != '')
            then number(normalize-space(string($obl/@totalCassDatoratCoasigurat)))
            else 0"/>
        
        <!-- validare: totalCassDatorat = cass_optiune + totalCassDatoratCoasigurat -->
        <let name="isValid"
            value="$total = ($cassOpt + $cassCoasig)"/>
        
        <assert
            test="$isValid"
            flag="fatal"
            id="BR-D212-0020">
            [BR-D212-0020]
            <value-of select="
                if (normalize-space(string($desc)) != '')
                then $desc
                else $attName
                "/>
            (<value-of select="$attName"/>)
            din elementul <value-of select="name(..)"/>
            trebuie sa fie egal cu suma:
            cass_optiune + totalCassDatoratCoasigurat
            (atribute lipsa se considera 0).
        </assert>
        
    </rule>
    
    <!-- Regula: bazaCassCoasigurat = 24300 -->
    <rule context="//d212:coasigurat/@bazaCassCoasigurat">
        
        <let name="attName" value="name(.)"/>
        
        <let name="desc"
            value="$schema//xs:attribute[@name = $attName]
            /xs:annotation/xs:documentation[1]"/>
        
        <!-- valoarea numerică a bazei -->
        <let name="baza"
            value="number(normalize-space(.))"/>
        
        <let name="isValid"
            value="$baza = 24300"/>
        
        <assert
            test="$isValid"
            flag="fatal"
            id="BR-D212-0021">
            [BR-D212-0021]
            <value-of select="
                if (normalize-space($desc) != '')
                then $desc
                else $attName
                "/>
            (<value-of select="$attName"/>)
            din elementul <value-of select="name(..)"/>
            trebuie sa aiba valoarea 24300.
        </assert>
        
    </rule>
    <!-- Regula: cassDatoratCoasigurat = round(bazaCassCoasigurat * 10/100) -->
    <rule context="//d212:coasigurat/@cassDatoratCoasigurat">
        
        <let name="attName" value="name(.)"/>
        
        <let name="desc"
            value="$schema//xs:attribute[@name = $attName]
            /xs:annotation/xs:documentation[1]"/>
        
        <!-- valorile necesare -->
        <let name="cass"
            value="number(normalize-space(.))"/>
        
        <let name="baza"
            value="number(normalize-space(../@bazaCassCoasigurat))"/>
        
        <!-- calcul schematron: rotunjire la întreg -->
        <let name="calc"
            value="round($baza * 10 div 100)"/>
        
        <let name="isValid"
            value="$cass = $calc"/>
        
        <assert
            test="$isValid"
            flag="fatal"
            id="BR-D212-0022">
            [BR-D212-0022]
            <value-of select="
                if (normalize-space($desc) != '')
                then $desc
                else $attName
                "/>
            (<value-of select="$attName"/>)
            din elementul <value-of select="name(..)"/>
            trebuie sa fie egal cu 
            round(bazaCassCoasigurat × 10 / 100).
        </assert>
        
    </rule>
    <!-- Regula: orice atribut de tip data_* trebuie sa aiba anul = an_r - 1 -->
    <rule context="//@*[
        name() = 'data_incep'
        or name() = 'data_sf'
        or name() = 'data_suspendare'
        or name() = 'norma_data_incep'
        or name() = 'norma_data_sf'
        or name() = 'str_data_incep'
        or name() = 'str_data_sf'
        ]">
        
        <!-- numele atributului -->
        <let name="attName" value="name(.)"/>
        
        <!-- descriere din XSD (daca exista) -->
        <let name="desc"
            value="$schema//xs:attribute[@name = $attName]
            /xs:annotation/xs:documentation[1]"/>
        
        <!-- valoarea brută -->
        <let name="val" value="normalize-space(.)"/>
        
        <!-- anul din atributul dat (ultimele 4 caractere) -->
        <let name="yearAttr"
            value="substring($val, string-length($val) - 3, 4)"/>
        
        <!-- an_r luat de pe elementul radacina, indiferent de namespace -->
        <let name="an_r_val" value="normalize-space(/*/@an_r)"/>
        <let name="an_r_num" value="number($an_r_val)"/>
        
        <!-- anul de referinta = an_r - 1 -->
        <let name="yearExp" value="string($an_r_num - 1)"/>
        
        <!-- validare -->
        <let name="isValid"
            value="string-length($yearAttr) = 4 and $yearAttr = $yearExp"/>
        
        <assert test="$isValid"
            flag="fatal"
            id="BR-D212-0023">
            [BR-D212-0023]
            <value-of select="
                if (normalize-space($desc) != '')
                then $desc
                else $attName
                "/>
            (<value-of select="$attName"/>)
            din elementul <value-of select="name(..)"/>
            trebuie sa aiba anul egal cu <value-of select="$yearExp"/>. Anul completat: "<value-of select="$yearAttr"/>".
        </assert>
    </rule>
    <!-- Regula: data_sf >= data_incep (data calendaristica) -->
    <rule context="//*[@data_incep and @data_sf]">
        
        <let name="attStart" value="'data_incep'"/>
        <let name="attEnd"   value="'data_sf'"/>
        
        <!-- descrieri din XSD -->
        <let name="descStart"
            value="$schema//xs:attribute[@name = $attStart]
            /xs:annotation/xs:documentation[1]"/>
        <let name="descEnd"
            value="$schema//xs:attribute[@name = $attEnd]
            /xs:annotation/xs:documentation[1]"/>
        
        <!-- valori string -->
        <let name="valStart" value="normalize-space(@data_incep)"/>
        <let name="valEnd"   value="normalize-space(@data_sf)"/>
        
        <!-- coduri numerice YYYYMMDD -->
        <let name="codeStart"
            value="number(
            concat(
            substring($valStart, 7, 4),
            substring($valStart, 4, 2),
            substring($valStart, 1, 2)
            )
            )"/>
        
        <let name="codeEnd"
            value="number(
            concat(
            substring($valEnd, 7, 4),
            substring($valEnd, 4, 2),
            substring($valEnd, 1, 2)
            )
            )"/>
        
        <!-- regula: sfarsit >= inceput -->
        <let name="isValid" value="$codeEnd &gt;= $codeStart"/>
        
        <assert test="$isValid"
            flag="fatal"
            id="BR-D212-0024">
            [BR-D212-0024]
            <value-of select="
                if (normalize-space($descStart) != '')
                then $descStart
                else $attStart
                "/>
            (<value-of select="$attStart"/>)
            si
            <value-of select="
                if (normalize-space($descEnd) != '')
                then $descEnd
                else $attEnd
                "/>
            (<value-of select="$attEnd"/>)
            din elementul <value-of select="name(.)"/>
            trebuie sa reprezinte date calendaristice astfel incat
            data de sfarsit sa fie mai mare sau egala cu data de inceput.
            Valori: "<value-of select="$attStart"/>" = "<value-of select="$valStart"/>",
            "<value-of select="$attEnd"/>" = "<value-of select="$valEnd"/>".
        </assert>
        
    </rule>
    <!-- Regula: norma_data_sf >= norma_data_incep (data calendaristica) -->
    <rule context="//*[@norma_data_incep and @norma_data_sf]">
        
        <let name="attStart" value="'norma_data_incep'"/>
        <let name="attEnd"   value="'norma_data_sf'"/>
        
        <let name="descStart"
            value="$schema//xs:attribute[@name = $attStart]
            /xs:annotation/xs:documentation[1]"/>
        <let name="descEnd"
            value="$schema//xs:attribute[@name = $attEnd]
            /xs:annotation/xs:documentation[1]"/>
        
        <let name="valStart" value="normalize-space(@norma_data_incep)"/>
        <let name="valEnd"   value="normalize-space(@norma_data_sf)"/>
        
        <let name="codeStart"
            value="number(
            concat(
            substring($valStart, 7, 4),
            substring($valStart, 4, 2),
            substring($valStart, 1, 2)
            )
            )"/>
        
        <let name="codeEnd"
            value="number(
            concat(
            substring($valEnd, 7, 4),
            substring($valEnd, 4, 2),
            substring($valEnd, 1, 2)
            )
            )"/>
        
        <let name="isValid" value="$codeEnd &gt;= $codeStart"/>
        
        <assert test="$isValid"
            flag="fatal"
            id="BR-D212-0025">
            [BR-D212-0025]
            <value-of select="
                if (normalize-space($descStart) != '')
                then $descStart
                else $attStart
                "/>
            (<value-of select="$attStart"/>)
            si
            <value-of select="
                if (normalize-space($descEnd) != '')
                then $descEnd
                else $attEnd
                "/>
            (<value-of select="$attEnd"/>)
            din elementul <value-of select="name(.)"/>
            trebuie sa reprezinte date calendaristice astfel incat
            data de sfarsit sa fie mai mare sau egala cu data de inceput.
            Valori: "<value-of select="$attStart"/>" = "<value-of select="$valStart"/>",
            "<value-of select="$attEnd"/>" = "<value-of select="$valEnd"/>".
        </assert>
        
    </rule>
    <!-- Regula: str_data_sf >= str_data_incep (data calendaristica) -->
    <rule context="//*[@str_data_incep and @str_data_sf]">
        
        <let name="attStart" value="'str_data_incep'"/>
        <let name="attEnd"   value="'str_data_sf'"/>
        
        <let name="descStart"
            value="$schema//xs:attribute[@name = $attStart]
            /xs:annotation/xs:documentation[1]"/>
        <let name="descEnd"
            value="$schema//xs:attribute[@name = $attEnd]
            /xs:annotation/xs:documentation[1]"/>
        
        <let name="valStart" value="normalize-space(@str_data_incep)"/>
        <let name="valEnd"   value="normalize-space(@str_data_sf)"/>
        
        <let name="codeStart"
            value="number(
            concat(
            substring($valStart, 7, 4),
            substring($valStart, 4, 2),
            substring($valStart, 1, 2)
            )
            )"/>
        
        <let name="codeEnd"
            value="number(
            concat(
            substring($valEnd, 7, 4),
            substring($valEnd, 4, 2),
            substring($valEnd, 1, 2)
            )
            )"/>
        
        <let name="isValid" value="$codeEnd &gt;= $codeStart"/>
        
        <assert test="$isValid"
            flag="fatal"
            id="BR-D212-0026">
            [BR-D212-0026]
            <value-of select="
                if (normalize-space($descStart) != '')
                then $descStart
                else $attStart
                "/>
            (<value-of select="$attStart"/>)
            si
            <value-of select="
                if (normalize-space($descEnd) != '')
                then $descEnd
                else $attEnd
                "/>
            (<value-of select="$attEnd"/>)
            din elementul <value-of select="name(.)"/>
            trebuie sa reprezinte date calendaristice astfel incat
            data de sfarsit sa fie mai mare sau egala cu data de inceput.
            Valori: "<value-of select="$attStart"/>" = "<value-of select="$valStart"/>",
            "<value-of select="$attEnd"/>" = "<value-of select="$valEnd"/>".
        </assert>
        
    </rule>
    <!-- BR-D212-0028 + BR-D212-0029 intr-o singura regula context="/*" -->
    <rule context="/*">
        
        <!-- ============================= -->
        <!-- BR-D212-0028: existenta <-> nerezident = 1 -->
        <!-- ============================= -->
        
        <!-- descrieri din XSD -->
        <let name="desc_stat_0028"
            value="$schema//xs:attribute[@name='stat_rezidenta']
            /xs:annotation/xs:documentation[1]"/>
        
        <let name="desc_nerez_0028"
            value="$schema//xs:attribute[@name='nerezident']
            /xs:annotation/xs:documentation[1]"/>
        
        <!-- existenta atributului stat_rezidenta -->
        <let name="hasStat_0028"
            value="exists(@stat_rezidenta)"/>
        
        <!-- valoarea atributului nerezident -->
        <let name="nerez_0028"
            value="normalize-space(@nerezident)"/>
        
        <!-- regula 0028: stat_rezidenta exista <=> nerezident = 1 -->
        <let name="isValid_0028"
            value="($nerez_0028 = '1' and $hasStat_0028)
            or ($nerez_0028 != '1' and not($hasStat_0028))"/>
        
        <assert test="$isValid_0028"
            flag="fatal"
            id="BR-D212-0028">
            [BR-D212-0028]
            Atributul 
            <value-of select="
                if (normalize-space($desc_stat_0028) != '')
                then $desc_stat_0028
                else 'stat_rezidenta'
                "/>
            (stat_rezidenta)
            si atributul 
            <value-of select="
                if (normalize-space($desc_nerez_0028) != '')
                then $desc_nerez_0028
                else 'nerezident'
                "/>
            (nerezident)
            trebuie corelate astfel:
            - daca bifa Nerezident este activata, atunci tara de rezidenta trebuie sa fie completata,
            - daca bifa Nerezident nu este activata, atunci tara de rezidenta nu trebuie sa fie completata.
        </assert>
        
        
        <!-- ============================= -->
        <!-- BR-D212-0029: stat_rezidenta != 'RO' -->
        <!-- ============================= -->
        
        <!-- valoarea efectivă a stat_rezidenta (daca exista) -->
        <let name="val_stat_0029"
            value="normalize-space(@stat_rezidenta)"/>
        
        <!-- stat_rezidenta este prezent? -->
        <let name="hasStat_0029"
            value="string-length($val_stat_0029) &gt; 0"/>
        
        <!-- descriere (reutilizam descrierea din 0028) -->
        <let name="desc_stat_0029"
            value="$desc_stat_0028"/>
        
        <!-- valid: daca stat_rezidenta exista, atunci nu are voie sa fie 'RO' -->
        <let name="isValid_0029"
            value="not($hasStat_0029 and upper-case($val_stat_0029) = 'RO')"/>
        
        <assert test="$isValid_0029"
            flag="fatal"
            id="BR-D212-0029">
            [BR-D212-0029]
            <value-of select="
                if (normalize-space($desc_stat_0029) != '')
                then $desc_stat_0029
                else 'stat_rezidenta'
                "/>
            (stat_rezidenta)
            din elementul <value-of select="name(.)"/>
            nu trebuie sa aiba valoarea 'Romania(RO)'.
        </assert>
       
        
        <!-- ========================= -->
        <!-- VARIABILE COMUNE RADACINA -->
        <!-- ========================= -->
        
        <!-- d_rec, rectif1, rectif2 -->
        <let name="drec_root"  value="normalize-space(string(@d_rec))"/>
        <let name="rect1_root" value="normalize-space(string(@rectif1))"/>
        <let name="rect2_root" value="normalize-space(string(@rectif2))"/>
        
        <!-- Bife pe radacina (venituri realizate) -->
        <let name="bifa111_root" value="normalize-space(string(@bifa111))"/>
        <let name="bifa112_root" value="normalize-space(string(@bifa112))"/>
        <let name="bifa113_root" value="normalize-space(string(@bifa113))"/>
        <let name="bifa121_root" value="normalize-space(string(@bifa121))"/>
        <let name="bifa122_root" value="normalize-space(string(@bifa122))"/>
        <let name="bifa131_root" value="normalize-space(string(@bifa131))"/>
        <let name="bifa132_root" value="normalize-space(string(@bifa132))"/>
        <let name="bifa14_root"  value="normalize-space(string(@bifa14))"/>
        <let name="bifa15_root"  value="normalize-space(string(@bifa15))"/>
        <let name="bifa19_root"  value="normalize-space(string(@bifa19))"/>
        <let name="bifa23_root"  value="normalize-space(string(@bifa23))"/>
        
        <!-- Bife pe <oblig_estimat> (prima aparitie, daca exista) -->
        <let name="bifaOpt_root"
            value="normalize-space(string((.//d212:oblig_estimat/@bifa_optiune)[1]))"/>
        <let name="bifaOptCoas_root"
            value="normalize-space(string((.//d212:oblig_estimat/@bifa_optiune_coasigurat)[1]))"/>
        
        
        <!-- ===================================================== -->
        <!-- BR-D212-0031: d_rec=0 si toate bifele relevante = 0   -->
        <!-- ===================================================== -->
        
        <!-- Exista cel putin o bifă relevanta = '1'? -->
        <let name="hasAnyOne_0031"
            value="$bifa111_root = '1'
            or $bifa112_root = '1'
            or $bifa113_root = '1'
            or $bifa121_root = '1'
            or $bifa122_root = '1'
            or $bifa131_root = '1'
            or $bifa132_root = '1'
            or $bifa14_root  = '1'
            or $bifa15_root  = '1'
            or $bifa19_root  = '1'
            or $bifa23_root  = '1'
            or $bifaOpt_root = '1'
            or $bifaOptCoas_root = '1'"/>
        
        <!-- Declaratie initiala? -->
        <let name="isInitial_0031" value="$drec_root = '0'"/>
        
        <!-- Valid: fie nu e initiala, fie avem macar o bifa = 1 -->
        <let name="isValid_0031"
            value="not($isInitial_0031 and not($hasAnyOne_0031))"/>
        
        <assert test="$isValid_0031"
            flag="fatal"
            id="BR-D212-0031">
            [BR-D212-0031]
            Trebuie sa completati Venituri realizate, 
            sau sa bifați CASS prin opțiune, 
            sau Persoane în întreținere – oricare, în orice combinație
        </assert>
        
        
        <!-- =========================================================== -->
        <!-- BR-D212-0033: rectif1=0, rectif2=1 => nicio bifa de venit   -->
        <!-- =========================================================== -->
        
        <!-- exista cel putin o bifa de venit activata? -->
        <let name="hasVenituri_0033"
            value="$bifa111_root='1' or $bifa112_root='1' or $bifa113_root='1'
            or $bifa121_root='1' or $bifa122_root='1'
            or $bifa131_root='1' or $bifa132_root='1'
            or $bifa14_root='1'  or $bifa15_root='1'
            or $bifa19_root='1'  or $bifa23_root='1'"/>
        
        <!-- validare: daca rectif1=0 si rectif2=1 => nicio bifa de venit nu trebuie sa fie 1 -->
        <let name="isValid_0033"
            value="not( ($rect1_root='0' and $rect2_root='1') and $hasVenituri_0033 )"/>
        
        <assert test="$isValid_0033"
            flag="fatal"
            id="BR-D212-0033">
            [BR-D212-0033]
            În cazul în care se rectifică doar CASS prin opțiune sau persoane în întreținere
            (Doresc sa rectific optiunile pe anul curent),
            secțiunea „Venituri realizate” nu trebuie completata.
        </assert>
        
        <!-- DEBUG 0030 -->
        <assert test="true()" flag="warning" id="DBG-BUS2-ROOT">
            [DBG] business-2 rule context="/*" a rulat pe: <value-of select="name(.)"/>
            nerezident="<value-of select="normalize-space(@nerezident)"/>"
            hasCifStr="<value-of select="exists(@cif_str)"/>"
        </assert>
        
        
        
        <!-- =============================================== -->
        <!-- BR-D212-0030: cif_str != null <=> nerezident=1 -->
        <!-- =============================================== -->
        
        <!-- Descrierea atributului cif_str -->
        <let name="desc_cifstr_0030"
            value="$schema//xs:attribute[@name='cif_str']
            /xs:annotation/xs:documentation[1]"/>
        
        <!-- Descrierea atributului nerezident -->
        <let name="desc_nerez_0030"
            value="$schema//xs:attribute[@name='nerezident']
            /xs:annotation/xs:documentation[1]"/>
        
        <!-- Existența atributului cif_str -->
        <let name="hasCifStr_0030"
            value="exists(@cif_str)"/>
        
        <!-- Valoarea atributului nerezident -->
        <let name="nerez_0030"
            value="normalize-space(@nerezident)"/>
        
        <!-- Regula: cif_str există ↔ nerezident = 1 -->
        <let name="isValid_0030"
            value="( $nerez_0030 = '1' and $hasCifStr_0030 )
            or ( $nerez_0030 != '1' and not($hasCifStr_0030) )"/>
        
        <assert test="$isValid_0030"
            flag="fatal"
            id="BR-D212-0030">
            [BR-D212-0030]
            Atributul 
            <value-of select="
                if (normalize-space($desc_cifstr_0030)!='')
                then $desc_cifstr_0030
                else 'cif_str'
                "/>
            (cif_str)
            si atributul 
            <value-of select="
                if (normalize-space($desc_nerez_0030)!='')
                then $desc_nerez_0030
                else 'nerezident'
                "/>
            (nerezident)
            trebuie corelate astfel:
            - daca bifa Nerezident este activata, atunci Cod de identificare fiscala din strainatate trebuie sa fie completat,
            - daca bifa Nerezident nu este activata, atunci Cod de identificare fiscala din strainatate nu trebuie sa fie completat.
        </assert>
        
        
        <!-- ===================================================================== -->
        <!-- BR-D212-0032: rectif1=1, rectif2=0 => NU bifa_optiune / coasigurat    -->
        <!-- ===================================================================== -->
        
        <!-- descrieri din XSD pentru bifa_optiune si bifa_optiune_coasigurat -->
        <let name="desc_opt_0032"
            value="$schema//xs:attribute[@name = 'bifa_optiune']
            /xs:annotation/xs:documentation[1]"/>
        <let name="desc_optCoas_0032"
            value="$schema//xs:attribute[@name = 'bifa_optiune_coasigurat']
            /xs:annotation/xs:documentation[1]"/>
        
        <!-- Se rectifica DOAR Venituri realizate? -->
        <let name="isRectOnlyVenituri_0032"
            value="$rect1_root = '1' and $rect2_root = '0'"/>
        
        <!-- Exista cel putin una dintre bifele de optiune = 1? -->
        <let name="hasOptBifa_0032"
            value="$bifaOpt_root = '1' or $bifaOptCoas_root = '1'"/>
        
        <!-- Valid:
         - fie nu suntem in scenariul rectif1=1 & rectif2=0
         - fie suntem in acel scenariu, dar NU exista bifa_opt sau bifa_opt_coasigurat = 1 -->
        <let name="isValid_0032"
            value="not($isRectOnlyVenituri_0032 and $hasOptBifa_0032)"/>
        
        <assert test="$isValid_0032"
            flag="fatal"
            id="BR-D212-0032">
            [BR-D212-0032]
            In cazul in care se rectifica doar Venituri realizate
            (rectif1 = 1 si rectif2 = 0),
            casutele
            <value-of select="
                if (normalize-space($desc_opt_0032) != '')
                then $desc_opt_0032
                else 'bifa_optiune'
                "/>
            (bifa_optiune)
            si
            <value-of select="
                if (normalize-space($desc_optCoas_0032) != '')
                then $desc_optCoas_0032
                else 'bifa_optiune_coasigurat'
                "/>
            (bifa_optiune_coasigurat)
            nu trebuie sa fie bifate (nu trebuie sa aiba valoarea 1).
        </assert>
        <!-- =================================================== -->
        <!-- REGULI:  bifa113 / oblig_realizat                 -->
        <!-- =================================================== -->
        
        <!-- descrieri din XSD -->
        <let name="desc_bifa113_003x"
            value="$schema//xs:attribute[@name='bifa113']
            /xs:annotation/xs:documentation[1]"/>
        
        <let name="desc_real_camere_0034"
            value="$schema//xs:attribute[@name='real_camere_inchiriere']
            /xs:annotation/xs:documentation[1]"/>
        
        <let name="desc_real_venit_0035"
            value="$schema//xs:attribute[@name='real_venit_inchiriere']
            /xs:annotation/xs:documentation[1]"/>
        
        <let name="desc_real_impozit_0036"
            value="$schema//xs:attribute[@name='real_impozit_inchiriere']
            /xs:annotation/xs:documentation[1]"/>
        
        <!-- valori din oblig_realizat (daca exista) -->
        <let name="real_camere_113_root"
            value="normalize-space(string((.//d212:oblig_realizat/@real_camere_inchiriere)[1]))"/>
        <let name="real_venit_113_root"
            value="normalize-space(string((.//d212:oblig_realizat/@real_venit_inchiriere)[1]))"/>
        <let name="real_impozit_113_root"
            value="normalize-space(string((.//d212:oblig_realizat/@real_impozit_inchiriere)[1]))"/>
        
        <let name="has_real_camere_0034" value="string-length($real_camere_113_root) &gt; 0"/>
        <let name="has_real_venit_0035"  value="string-length($real_venit_113_root) &gt; 0"/>
        <let name="has_real_impozit_0036" value="string-length($real_impozit_113_root) &gt; 0"/>
        
        <!-- BR-D212-0034: IF bifa113=1 THEN real_camere_inchiriere <> null -->
        <let name="isValid_0034"
            value="not($bifa113_root = '1') or $has_real_camere_0034"/>
        
        <assert test="$isValid_0034" flag="fatal" id="BR-D212-0034">
            [BR-D212-0034]
            Daca ati ales sa declarati venituri din inchirierea in scop turistic a camerelor situate in locuinte proprietate personala impuse pe baza normelor de venit,
            atunci atributul
            <value-of select="
                if (normalize-space($desc_real_camere_0034) != '')
                then $desc_real_camere_0034
                else 'real_camere_inchiriere'
                "/>
            (real_camere_inchiriere)
            din elementul oblig_realizat
            trebuie sa fie completat.
        </assert>
        
        <!-- BR-D212-0035: IF bifa113=1 THEN real_venit_inchiriere <> null -->
        <let name="isValid_0035"
            value="not($bifa113_root = '1') or $has_real_venit_0035"/>
        
        <assert test="$isValid_0035" flag="fatal" id="BR-D212-0035">
            [BR-D212-0035]
            Daca ati ales sa declarati venituri din inchirierea in scop turistic a camerelor situate in locuinte proprietate personala impuse pe baza normelor de venit,
            atunci atributul
            <value-of select="
                if (normalize-space($desc_real_venit_0035) != '')
                then $desc_real_venit_0035
                else 'real_venit_inchiriere'
                "/>
            (real_venit_inchiriere)
            din elementul oblig_realizat
            trebuie sa fie completat.
        </assert>
        
        <!-- BR-D212-0036: IF bifa113=1 THEN real_impozit_inchiriere = round(real_venit_inchiriere * 10/100) -->
        <!-- protectie numeric: NaN -> invalid -->
        <let name="venit_num_0036" value="number($real_venit_113_root)"/>
        <let name="impozit_num_0036" value="number($real_impozit_113_root)"/>
        <let name="venit_is_numeric_0036" value="not($venit_num_0036 != $venit_num_0036)"/>
        <let name="impozit_is_numeric_0036" value="not($impozit_num_0036 != $impozit_num_0036)"/>
        
        <let name="impozit_calc_0036" value="round($venit_num_0036 * 10 div 100)"/>
        
        <let name="isValid_0036"
            value="not($bifa113_root = '1')
            or (
            $has_real_venit_0035
            and $has_real_impozit_0036
            and $venit_is_numeric_0036
            and $impozit_is_numeric_0036
            and ($impozit_num_0036 = $impozit_calc_0036)
            )"/>
        
        <assert test="$isValid_0036" flag="fatal" id="BR-D212-0036">
            [BR-D212-0036]
            Daca ati ales sa declarati venituri din inchirierea in scop turistic a camerelor situate in locuinte proprietate personala impuse pe baza normelor de venit,
            atunci atributul
            <value-of select="
                if (normalize-space($desc_real_impozit_0036) != '')
                then $desc_real_impozit_0036
                else 'real_impozit_inchiriere'
                "/>
            (real_impozit_inchiriere)
            din elementul oblig_realizat
            trebuie sa fie egal cu round(real_venit_inchiriere * 10 / 100).
            Valoare asteptata: <value-of select="$impozit_calc_0036"/>.
        </assert>
      
        <!-- =================================================== -->
        <!-- REGULI  bifa122 / oblig_realizat                 -->
        <!-- =================================================== -->
        
        <!-- descrieri din XSD -->
        <let name="desc_bifa122_003x"
            value="$schema//xs:attribute[@name='bifa122']
            /xs:annotation/xs:documentation[1]"/>
        
        <let name="desc_str_cas_baza_0037"
            value="$schema//xs:attribute[@name='str_cas_baza']
            /xs:annotation/xs:documentation[1]"/>
        <let name="desc_str_cas_datorat_0038"
            value="$schema//xs:attribute[@name='str_cas_datorat']
            /xs:annotation/xs:documentation[1]"/>
        
        <let name="desc_str_cass_baza_0039"
            value="$schema//xs:attribute[@name='str_cass_baza']
            /xs:annotation/xs:documentation[1]"/>
        <let name="desc_str_cass_datorat_0040"
            value="$schema//xs:attribute[@name='str_cass_datorat']
            /xs:annotation/xs:documentation[1]"/>
        
        <!-- valori din oblig_realizat (prima aparitie, daca exista) -->
        <let name="str_cas_baza_122_root"
            value="normalize-space(string((.//d212:oblig_realizat/@str_cas_baza)[1]))"/>
        <let name="str_cas_datorat_122_root"
            value="normalize-space(string((.//d212:oblig_realizat/@str_cas_datorat)[1]))"/>
        
        <let name="str_cass_baza_122_root"
            value="normalize-space(string((.//d212:oblig_realizat/@str_cass_baza)[1]))"/>
        <let name="str_cass_datorat_122_root"
            value="normalize-space(string((.//d212:oblig_realizat/@str_cass_datorat)[1]))"/>
        
        <let name="has_str_cas_baza_0037" value="string-length($str_cas_baza_122_root) &gt; 0"/>
        <let name="has_str_cas_datorat_0038" value="string-length($str_cas_datorat_122_root) &gt; 0"/>
        
        <let name="has_str_cass_baza_0039" value="string-length($str_cass_baza_122_root) &gt; 0"/>
        <let name="has_str_cass_datorat_0040" value="string-length($str_cass_datorat_122_root) &gt; 0"/>
        
        <!-- BR-D212-0037: IF bifa122=1 THEN str_cas_baza <> null -->
        <let name="isValid_0037"
            value="not($bifa122_root = '1') or $has_str_cas_baza_0037"/>
        
        <assert test="$isValid_0037" flag="fatal" id="BR-D212-0037">
            [BR-D212-0037]
            Daca ati ales sa declarati venituri asimilate salariilor pentru activitatea desfasurata in strainatate, pentru care se datoreaza CAS,
            atunci atributul
            <value-of select="
                if (normalize-space($desc_str_cas_baza_0037) != '')
                then $desc_str_cas_baza_0037
                else 'str_cas_baza'
                "/>
            (str_cas_baza)
            din elementul oblig_realizat
            trebuie sa fie completat.
        </assert>
        
        <!-- BR-D212-0038: IF bifa122=1 THEN str_cas_datorat = round(str_cas_baza * 25/100) -->
        <let name="cas_baza_num_0038" value="number($str_cas_baza_122_root)"/>
        <let name="cas_dat_num_0038"  value="number($str_cas_datorat_122_root)"/>
        <let name="cas_baza_is_numeric_0038" value="not($cas_baza_num_0038 != $cas_baza_num_0038)"/>
        <let name="cas_dat_is_numeric_0038"  value="not($cas_dat_num_0038 != $cas_dat_num_0038)"/>
        
        <let name="cas_calc_0038" value="round($cas_baza_num_0038 * 25 div 100)"/>
        
        <let name="isValid_0038"
            value="not($bifa122_root = '1')
            or (
            $has_str_cas_baza_0037
            and $has_str_cas_datorat_0038
            and $cas_baza_is_numeric_0038
            and $cas_dat_is_numeric_0038
            and ($cas_dat_num_0038 = $cas_calc_0038)
            )"/>
        
        <assert test="$isValid_0038" flag="fatal" id="BR-D212-0038">
            [BR-D212-0038]
            Daca ati ales sa declarati venituri asimilate salariilor pentru activitatea desfasurata in strainatate, pentru care se datoreaza CAS,
            atunci atributul
            <value-of select="
                if (normalize-space($desc_str_cas_datorat_0038) != '')
                then $desc_str_cas_datorat_0038
                else 'str_cas_datorat'
                "/>
            (str_cas_datorat)
            din elementul oblig_realizat
            trebuie sa fie egal cu round(str_cas_baza * 25 / 100).
            Valoare asteptata: <value-of select="$cas_calc_0038"/>.
        </assert>
        
        <!-- BR-D212-0039: IF bifa122=1 THEN str_cass_baza <> null -->
        <let name="isValid_0039"
            value="not($bifa122_root = '1') or $has_str_cass_baza_0039"/>
        
        <assert test="$isValid_0039" flag="fatal" id="BR-D212-0039">
            [BR-D212-0039]
            Daca ati ales sa declarati venituri asimilate salariilor pentru activitatea desfasurata in strainatate, pentru care se datoreaza CASS,
            atunci atributul
            <value-of select="
                if (normalize-space($desc_str_cass_baza_0039) != '')
                then $desc_str_cass_baza_0039
                else 'str_cass_baza'
                "/>
            (str_cass_baza)
            din elementul oblig_realizat
            trebuie sa fie completat.
        </assert>
        
        <!-- BR-D212-0040: IF bifa122=1 THEN str_cass_datorat = round(str_cass_baza * 10/100) -->
        <let name="cass_baza_num_0040" value="number($str_cass_baza_122_root)"/>
        <let name="cass_dat_num_0040"  value="number($str_cass_datorat_122_root)"/>
        <let name="cass_baza_is_numeric_0040" value="not($cass_baza_num_0040 != $cass_baza_num_0040)"/>
        <let name="cass_dat_is_numeric_0040"  value="not($cass_dat_num_0040 != $cass_dat_num_0040)"/>
        
        <let name="cass_calc_0040" value="round($cass_baza_num_0040 * 10 div 100)"/>
        
        <let name="isValid_0040"
            value="not($bifa122_root = '1')
            or (
            $has_str_cass_baza_0039
            and $has_str_cass_datorat_0040
            and $cass_baza_is_numeric_0040
            and $cass_dat_is_numeric_0040
            and ($cass_dat_num_0040 = $cass_calc_0040)
            )"/>
        
        <assert test="$isValid_0040" flag="fatal" id="BR-D212-0040">
            [BR-D212-0040]
            Daca ati ales sa declarati venituri asimilate salariilor pentru activitatea desfasurata in strainatate, pentru care se datoreaza CASS,
            atunci atributul
            <value-of select="
                if (normalize-space($desc_str_cass_datorat_0040) != '')
                then $desc_str_cass_datorat_0040
                else 'str_cass_datorat'
                "/>
            (str_cass_datorat)
            din elementul oblig_realizat
            trebuie sa fie egal cu round(str_cass_baza * 10 / 100).
            Valoare asteptata: <value-of select="$cass_calc_0040"/>.
        </assert>
     </rule>
    <!-- Regula: data_suspendare trebuie sa fie intre data_incep si data_sf (inclusiv) -->
    <rule context="//*[@data_incep and @data_sf and @data_suspendare]">
        
        <!-- numele atributelor -->
        <let name="attStart" value="'data_incep'"/>
        <let name="attEnd"   value="'data_sf'"/>
        <let name="attSusp"  value="'data_suspendare'"/>
        
        <!-- descrieri din XSD -->
        <let name="descStart"
            value="$schema//xs:attribute[@name = $attStart]
            /xs:annotation/xs:documentation[1]"/>
        <let name="descEnd"
            value="$schema//xs:attribute[@name = $attEnd]
            /xs:annotation/xs:documentation[1]"/>
        <let name="descSusp"
            value="$schema//xs:attribute[@name = $attSusp]
            /xs:annotation/xs:documentation[1]"/>
        
        <!-- valori string dd.mm.yyyy -->
        <let name="valStart" value="normalize-space(@data_incep)"/>
        <let name="valEnd"   value="normalize-space(@data_sf)"/>
        <let name="valSusp"  value="normalize-space(@data_suspendare)"/>
        
        <!-- verificam format minim: 10 caractere de forma dd.mm.yyyy -->
        <let name="hasAllDates"
            value="string-length($valStart) = 10
            and string-length($valEnd) = 10
            and string-length($valSusp) = 10"/>
        
        <!-- coduri lexicografice YYYYMMDD (string, nu numar) -->
        <let name="codeStart"
            value="concat(
            substring($valStart, 7, 4),
            substring($valStart, 4, 2),
            substring($valStart, 1, 2)
            )"/>
        
        <let name="codeEnd"
            value="concat(
            substring($valEnd, 7, 4),
            substring($valEnd, 4, 2),
            substring($valEnd, 1, 2)
            )"/>
        
        <let name="codeSusp"
            value="concat(
            substring($valSusp, 7, 4),
            substring($valSusp, 4, 2),
            substring($valSusp, 1, 2)
            )"/>
        
        <!-- regula: data_incep <= data_suspendare <= data_sf, comparate ca string YYYYMMDD -->
        <let name="isValid"
            value="$hasAllDates
            and $codeSusp &gt;= $codeStart
            and $codeSusp &lt;= $codeEnd"/>
        
        <!-- DEBUG OBLIGATORIU: se aprinde INTOTDEAUNA cand exista cele 3 date 
        <assert test="true()" flag="warning" id="DBG-0027">
            [DEBUG BR-D212-0027]
            element = <value-of select="name(.)"/> ;
            start = "<value-of select="$valStart"/>" (code=<value-of select="$codeStart"/>)
            susp  = "<value-of select="$valSusp"/>" (code=<value-of select="$codeSusp"/>)
            end   = "<value-of select="$valEnd"/>"   (code=<value-of select="$codeEnd"/>)
            hasAllDates = "<value-of select="$hasAllDates"/>" ;
            isValid     = "<value-of select="$isValid"/>".
        </assert>
        -->
        <!-- EROAREA REALA -->
        <assert test="$isValid"
            flag="fatal"
            id="BR-D212-0027">
            [BR-D212-0027]
            <value-of select="
                if (normalize-space($descSusp) != '')
                then $descSusp
                else $attSusp
                "/>
            (<value-of select="$attSusp"/>)
            din elementul <value-of select="name(.)"/>
            trebuie sa fie cuprinsa intre
            <value-of select="
                if (normalize-space($descStart) != '')
                then $descStart
                else $attStart
                "/>
            (<value-of select="$attStart"/>) si
            <value-of select="
                if (normalize-space($descEnd) != '')
                then $descEnd
                else $attEnd
                "/>
            (<value-of select="$attEnd"/>),
            adica sa reprezinte o data calendaristica intre data de inceput
            si data de sfarsit (inclusiv).
        </assert>
        
 
    </rule>
    
    
 
</pattern>




